import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AssetType, StorageProvider } from "@prisma/client";
import * as archiver from "archiver";
import * as crypto from "crypto";
import * as mime from "mime-types";
import { I18nService } from "nestjs-i18n";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { S3ObjectStorageService } from "src/storage/s3ObjectStorage.service";
import { Readable } from "stream";
import { validate as isValidUUID } from "uuid";
import { File } from "./file.service";

@Injectable()
export class S3FileService {
  private readonly logger = new Logger(S3FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: S3ObjectStorageService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
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

    try {
      await this.objects.saveChunk(
        file.id,
        this.objects.assetKey(file.id),
        data,
        chunk,
        {
          contentType: mime.lookup(file.name) || "application/octet-stream",
        },
      );
    } catch (error) {
      try {
        await this.objects.abortMultipart(file.id);
      } catch (abortError) {
        this.logger.warn(abortError);
      }
      this.logger.error(error);
      throw new Error(this.i18n.t("file.s3UploadFailed"));
    }

    if (chunk.index === chunk.total - 1) {
      const share = await this.prisma.share.findUnique({
        where: { id: shareId },
        select: { creatorId: true },
      });
      const fileSize = await this.getFileSize(file.id);

      await this.prisma.asset.create({
        data: {
          id: file.id,
          type: AssetType.FILE,
          name: file.name,
          size: fileSize.toString(),
          mimeType: mime.lookup(file.name) || "application/octet-stream",
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

    const object = await this.objects.getStream(
      this.objects.assetKey(asset.storageKey ?? fileId),
    );

    return {
      metaData: {
        id: fileId,
        size: asset.size || object.size.toString(),
        name: asset.name,
        shareId,
        createdAt: asset.createdAt || object.lastModified || new Date(),
        mimeType:
          asset.mimeType ||
          object.contentType ||
          mime.contentType(asset.name?.split(".").pop()) ||
          "application/octet-stream",
      },
      file: object.body,
    } as File;
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.asset.findFirst({
      where: { id: fileId, shareId, type: AssetType.FILE },
    });
    if (!fileMetaData) {
      throw new NotFoundException(this.i18n.t("file.notFound"));
    }

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
        await this.objects.abortMultipart(fileId);
        await this.objects.delete(this.objects.assetKey(storageKey));
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
    try {
      return await this.objects.getSize(this.objects.assetKey(assetId));
    } catch {
      throw new Error(this.i18n.t("file.s3SizeError"));
    }
  }

  async getZip(shareId: string) {
    const files = await this.prisma.asset.findMany({
      where: { shareId, type: AssetType.FILE },
    });
    if (files.length === 0) {
      throw new NotFoundException(`No files found for share ${shareId}`);
    }

    const archive = archiver("zip", {
      zlib: { level: parseInt(this.config.get("share.zipCompressionLevel")) },
    });
    archive.on("error", (error) => this.logger.error("Archive error", error));

    const processFiles = async () => {
      for (const file of files) {
        try {
          const object = await this.objects.getStream(
            this.objects.assetKey(file.storageKey ?? file.id),
          );
          archive.append(object.body, { name: file.name });
          await new Promise<void>((resolve, reject) => {
            object.body.on("end", resolve);
            object.body.on("error", reject);
          });
        } catch (error) {
          this.logger.error(`Error processing file ${file.name}`, error);
        }
      }
      await archive.finalize();
    };

    void processFiles();
    return archive as Readable;
  }
}
