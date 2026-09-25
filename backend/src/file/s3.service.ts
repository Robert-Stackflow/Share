import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
  UploadPartCommandOutput,
} from "@aws-sdk/client-s3";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import { I18nService } from "nestjs-i18n";
import * as crypto from "crypto";
import * as mime from "mime-types";
import { File } from "./file.service";
import { Readable } from "stream";
import { validate as isValidUUID } from "uuid";
import * as archiver from "archiver";
import { AssetType, StorageProvider } from "@prisma/client";

@Injectable()
export class S3FileService {
  private readonly logger = new Logger(S3FileService.name);

  private multipartUploads: Record<
    string,
    {
      uploadId: string;
      parts: Array<{ ETag: string | undefined; PartNumber: number }>;
    }
  > = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    shareId: string,
  ) {
    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    const buffer = Buffer.from(data, "base64");
    const key = this.getAssetKey(file.id);
    const bucketName = this.config.get("s3.bucketName");
    const s3Instance = this.getS3Instance();

    try {
      // Initialize multipart upload if it's the first chunk
      if (chunk.index === 0) {
        const multipartInitResponse = await s3Instance.send(
          new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
          }),
        );

        const uploadId = multipartInitResponse.UploadId;
        if (!uploadId) {
          throw new Error(this.i18n.t("file.s3UploadInitError"));
        }

        // Store the uploadId and parts list in memory
        this.multipartUploads[file.id] = {
          uploadId,
          parts: [],
        };
      }

      // Get the ongoing multipart upload
      const multipartUpload = this.multipartUploads[file.id];
      if (!multipartUpload) {
        throw new InternalServerErrorException(
          this.i18n.t("file.s3SessionNotFound"),
        );
      }

      const uploadId = multipartUpload.uploadId;

      // Upload the current chunk
      const partNumber = chunk.index + 1; // Part numbers start from 1

      const uploadPartResponse: UploadPartCommandOutput = await s3Instance.send(
        new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        }),
      );

      // Store the ETag and PartNumber for later completion
      multipartUpload.parts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber,
      });

      // Complete the multipart upload if it's the last chunk
      if (chunk.index === chunk.total - 1) {
        await s3Instance.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: multipartUpload.parts,
            },
          }),
        );

        // Remove the completed upload from memory
        delete this.multipartUploads[file.id];
      }
    } catch (error) {
      // Abort the multipart upload if it fails
      const multipartUpload = this.multipartUploads[file.id];
      if (multipartUpload) {
        try {
          await s3Instance.send(
            new AbortMultipartUploadCommand({
              Bucket: bucketName,
              Key: key,
              UploadId: multipartUpload.uploadId,
            }),
          );
        } catch (abortError) {
          console.error("Error aborting multipart upload:", abortError);
        }
        delete this.multipartUploads[file.id];
      }
      this.logger.error(error);
      throw new Error(this.i18n.t("file.s3UploadFailed"));
    }

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      const share = await this.prisma.share.findUnique({
        where: { id: shareId },
        select: { creatorId: true },
      });
      const fileSize: number = await this.getFileSize(file.id);

      await this.prisma.asset.create({
        data: {
          id: file.id,
          type: AssetType.FILE,
          name: file.name,
          size: fileSize.toString(),
          mimeType:
            mime.lookup(file.name) || "application/octet-stream",
          storage: StorageProvider.S3,
          share: { connect: { id: shareId } },
          ...(share?.creatorId
            ? { owner: { connect: { id: share.creatorId } } }
            : {}),
        },
      });
    }

    return file;
  }

  async get(shareId: string, fileId: string): Promise<File> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: fileId, shareId, type: AssetType.FILE },
    });

    if (!asset) throw new NotFoundException(this.i18n.t("file.notFound"));

    const s3Instance = this.getS3Instance();
    const key = this.getAssetKey(asset.storageKey ?? fileId);
    const response = await s3Instance.send(
      new GetObjectCommand({
        Bucket: this.config.get("s3.bucketName"),
        Key: key,
      }),
    );

    return {
      metaData: {
        id: fileId,
        size: asset.size || response.ContentLength?.toString() || "0",
        name: asset.name,
        shareId: shareId,
        createdAt: asset.createdAt || response.LastModified || new Date(),
        mimeType:
          asset.mimeType ||
          mime.contentType(asset.name?.split(".").pop()) ||
          "application/octet-stream",
      },
      file: response.Body as Readable,
    } as File;
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.asset.findFirst({
      where: { id: fileId, shareId, type: AssetType.FILE },
    });

    if (!fileMetaData)
      throw new NotFoundException(this.i18n.t("file.notFound"));

    await this.prisma.asset.delete({ where: { id: fileId } });
    const storageKey = fileMetaData.storageKey ?? fileId;
    const references = await this.prisma.asset.count({
      where: {
        type: AssetType.FILE,
        OR: [{ id: storageKey }, { storageKey }],
      },
    });
    if (references === 0) {
      try {
        await this.getS3Instance().send(
          new DeleteObjectCommand({
            Bucket: this.config.get("s3.bucketName"),
            Key: this.getAssetKey(storageKey),
          }),
        );
      } catch {
        throw new Error(this.i18n.t("file.s3DeleteError"));
      }
    }
  }

  async deleteAllFiles(shareId: string) {
    const files = await this.prisma.asset.findMany({
      where: { shareId, type: AssetType.FILE },
      select: { id: true },
    });
    for (const file of files) {
      await this.remove(shareId, file.id);
    }
  }

  async getFileSize(assetId: string): Promise<number> {
    const key = this.getAssetKey(assetId);
    const s3Instance = this.getS3Instance();

    try {
      // Get metadata of the file using HeadObjectCommand
      const headObjectResponse = await s3Instance.send(
        new HeadObjectCommand({
          Bucket: this.config.get("s3.bucketName"),
          Key: key,
        }),
      );

      // Return ContentLength which is the file size in bytes
      return headObjectResponse.ContentLength ?? 0;
    } catch {
      throw new Error(this.i18n.t("file.s3SizeError"));
    }
  }

  getS3Instance(): S3Client {
    const checksumCalculation =
      this.config.get("s3.useChecksum") === true ? null : "WHEN_REQUIRED";

    return new S3Client({
      endpoint: this.config.get("s3.endpoint"),
      region: this.config.get("s3.region"),
      credentials: {
        accessKeyId: this.config.get("s3.key"),
        secretAccessKey: this.config.get("s3.secret"),
      },
      forcePathStyle: this.config.get("s3.forcePathStyle"),
      requestChecksumCalculation: checksumCalculation,
      responseChecksumValidation: checksumCalculation,
    });
  }

  async getZip(shareId: string) {
    const files = await this.prisma.asset.findMany({
      where: { shareId, type: AssetType.FILE },
    });

    if (files.length === 0) {
      throw new NotFoundException(`No files found for share ${shareId}`);
    }

    const s3Instance = this.getS3Instance();
    const bucketName = this.config.get("s3.bucketName");
    const compressionLevel = this.config.get("share.zipCompressionLevel");
    const archive = archiver("zip", {
      zlib: { level: parseInt(compressionLevel) },
    });

    archive.on("error", (err) => {
      this.logger.error("Archive error", err);
    });

    const processFiles = async () => {
      for (const file of files) {
        const key = this.getAssetKey(file.storageKey ?? file.id);
        try {
          const response = await s3Instance.send(
            new GetObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );

          if (response.Body instanceof Readable) {
            const body = response.Body as Readable;
            archive.append(body, { name: file.name });
            // Wait for this file to be fully appended before moving to the next one to avoid overwhelming memory/connections
            await new Promise((resolve, reject) => {
              body.on("end", resolve);
              body.on("error", reject);
            });
          }
        } catch (error) {
          this.logger.error(`Error processing file ${file.name}`, error);
        }
      }
      archive.finalize();
    };

    processFiles();

    return archive;
  }

  getS3Path(): string {
    const configS3Path = this.config.get("s3.bucketPath");
    if (!configS3Path) return "";
    const normalized = `${configS3Path}`.replace(/^\/+|\/+$/g, "");
    return normalized ? `${normalized}/` : "";
  }

  private getAssetKey(assetId: string): string {
    return `${this.getS3Path()}assets/${assetId}`;
  }
}
