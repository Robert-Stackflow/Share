import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { Readable } from "stream";
import {
  StorageChunk,
  StorageListResult,
  StorageObject,
  StorageObjectStream,
} from "./storage.types";

type MultipartPart = {
  ETag?: string;
  PartNumber: number;
};

type PutOptions = {
  contentType?: string;
  metadata?: Record<string, string>;
};

type GetOptions = {
  range?: string;
};

type ListOptions = {
  delimiter?: string;
  continuationToken?: string;
  maxKeys?: number;
};

@Injectable()
export class S3ObjectStorageService {
  private readonly logger = new Logger(S3ObjectStorageService.name);
  private client?: S3Client;
  private clientSignature?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  assetKey(assetId: string): string {
    return `assets/${assetId}`;
  }

  resolveKey(key: string): string {
    const normalizedKey = this.normalizeKey(key);
    const configuredPath = `${this.config.get("s3.bucketPath") ?? ""}`
      .replace(/^\/+|\/+$/g, "")
      .trim();

    return configuredPath
      ? `${configuredPath}/${normalizedKey}`
      : normalizedKey;
  }

  async saveChunk(
    sessionId: string,
    key: string,
    data: string | Buffer,
    chunk: StorageChunk,
    options: PutOptions = {},
  ): Promise<void> {
    this.validateChunk(chunk);

    const objectKey = this.resolveKey(key);
    const bucket = this.getBucket();
    const client = this.getClient();

    if (chunk.index === 0) {
      await this.abortMultipart(sessionId);

      const created = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: objectKey,
          ContentType: options.contentType,
          Metadata: options.metadata,
        }),
      );

      if (!created.UploadId) {
        throw new InternalServerErrorException(
          "S3 upload initialization failed",
        );
      }

      try {
        await this.prisma.storageMultipartUpload.create({
          data: {
            id: sessionId,
            objectKey,
            uploadId: created.UploadId,
            parts: "[]",
            expectedParts: chunk.total,
          },
        });
      } catch (error) {
        await this.abortRemoteMultipart(objectKey, created.UploadId);
        throw error;
      }
    }

    const upload = await this.prisma.storageMultipartUpload.findUnique({
      where: { id: sessionId },
    });

    if (!upload) {
      throw new BadRequestException({
        message: "S3 upload session not found",
        error: "storage_upload_session_not_found",
      });
    }
    if (
      upload.objectKey !== objectKey ||
      upload.expectedParts !== chunk.total
    ) {
      throw new BadRequestException({
        message: "S3 upload session does not match the requested object",
        error: "storage_upload_session_mismatch",
      });
    }

    const partNumber = chunk.index + 1;
    const uploadedPart = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        PartNumber: partNumber,
        UploadId: upload.uploadId,
        Body: this.toBuffer(data),
      }),
    );

    const parts = this.parseParts(upload.parts).filter(
      (part) => part.PartNumber !== partNumber,
    );
    parts.push({ ETag: uploadedPart.ETag, PartNumber: partNumber });
    parts.sort((left, right) => left.PartNumber - right.PartNumber);

    await this.prisma.storageMultipartUpload.update({
      where: { id: sessionId },
      data: { parts: JSON.stringify(parts) },
    });

    if (parts.length !== chunk.total) {
      if (chunk.index === chunk.total - 1) {
        throw new BadRequestException({
          message: "S3 upload is missing one or more chunks",
          error: "storage_upload_incomplete",
        });
      }
      return;
    }

    const expectedPartNumbers = Array.from(
      { length: chunk.total },
      (_, index) => index + 1,
    );
    if (
      parts.some(
        (part, index) => part.PartNumber !== expectedPartNumbers[index],
      )
    ) {
      throw new BadRequestException({
        message: "S3 upload is missing one or more chunks",
        error: "storage_upload_incomplete",
      });
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: upload.uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
    await this.prisma.storageMultipartUpload.delete({
      where: { id: sessionId },
    });
  }

  async abortMultipart(sessionId: string): Promise<void> {
    const upload = await this.prisma.storageMultipartUpload.findUnique({
      where: { id: sessionId },
    });
    if (!upload) return;

    try {
      await this.abortRemoteMultipart(upload.objectKey, upload.uploadId);
    } finally {
      await this.prisma.storageMultipartUpload.deleteMany({
        where: { id: sessionId },
      });
    }
  }

  async abortMultipartOlderThan(cutoff: Date): Promise<number> {
    const uploads = await this.prisma.storageMultipartUpload.findMany({
      where: { updatedAt: { lt: cutoff } },
    });
    let aborted = 0;

    for (const upload of uploads) {
      try {
        await this.abortRemoteMultipart(upload.objectKey, upload.uploadId);
      } catch (error) {
        this.logger.warn(
          `Failed to abort stale multipart upload ${upload.id}: ${String(error)}`,
        );
        continue;
      }
      await this.prisma.storageMultipartUpload.deleteMany({
        where: { id: upload.id },
      });
      aborted++;
    }

    return aborted;
  }

  async put(
    key: string,
    body: string | Uint8Array | Buffer | Readable,
    options: PutOptions = {},
  ): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: this.resolveKey(key),
        Body: body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      }),
    );
  }

  async head(key: string): Promise<StorageObject> {
    const objectKey = this.resolveKey(key);
    const response = await this.getClient().send(
      new HeadObjectCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
      }),
    );

    return {
      key: this.stripConfiguredPath(objectKey),
      size: response.ContentLength ?? 0,
      etag: response.ETag,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  }

  async getStream(
    key: string,
    options: GetOptions = {},
  ): Promise<StorageObjectStream> {
    const objectKey = this.resolveKey(key);
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
        Range: options.range,
      }),
    );

    return {
      key: this.stripConfiguredPath(objectKey),
      size: response.ContentLength ?? 0,
      etag: response.ETag,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
      contentRange: response.ContentRange,
      body: response.Body as Readable,
    };
  }

  async getSize(key: string): Promise<number> {
    return (await this.head(key)).size;
  }

  async list(
    prefix: string,
    options: ListOptions = {},
  ): Promise<StorageListResult> {
    const objectPrefix = this.resolvePrefix(prefix);
    const response = await this.getClient().send(
      new ListObjectsV2Command({
        Bucket: this.getBucket(),
        Prefix: objectPrefix,
        Delimiter: options.delimiter,
        ContinuationToken: options.continuationToken,
        MaxKeys: options.maxKeys,
      }),
    );

    return {
      objects: (response.Contents ?? []).map((object) => ({
        key: this.stripConfiguredPath(object.Key ?? ""),
        size: object.Size ?? 0,
        etag: object.ETag,
        lastModified: object.LastModified,
      })),
      prefixes: (response.CommonPrefixes ?? []).flatMap((entry) =>
        entry.Prefix ? [this.stripConfiguredPath(entry.Prefix)] : [],
      ),
      continuationToken: response.NextContinuationToken,
    };
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    const source = `${this.getBucket()}/${this.resolveKey(sourceKey)}`;
    await this.getClient().send(
      new CopyObjectCommand({
        Bucket: this.getBucket(),
        CopySource: encodeURIComponent(source).replace(/%2F/g, "/"),
        Key: this.resolveKey(targetKey),
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.getBucket(),
        Key: this.resolveKey(key),
      }),
    );
  }

  private getClient(): S3Client {
    const clientConfig = {
      endpoint: this.config.get("s3.endpoint"),
      region: this.config.get("s3.region"),
      accessKeyId: this.config.get("s3.key"),
      secretAccessKey: this.config.get("s3.secret"),
      forcePathStyle: this.config.get("s3.forcePathStyle"),
      useChecksum: this.config.get("s3.useChecksum") === true,
    };
    const signature = JSON.stringify(clientConfig);

    if (!this.client || signature !== this.clientSignature) {
      this.client?.destroy();
      const checksumCalculation = clientConfig.useChecksum
        ? null
        : "WHEN_REQUIRED";
      this.client = new S3Client({
        endpoint: clientConfig.endpoint,
        region: clientConfig.region,
        credentials: {
          accessKeyId: clientConfig.accessKeyId,
          secretAccessKey: clientConfig.secretAccessKey,
        },
        forcePathStyle: clientConfig.forcePathStyle,
        requestChecksumCalculation: checksumCalculation,
        responseChecksumValidation: checksumCalculation,
      });
      this.clientSignature = signature;
    }

    return this.client;
  }

  private getBucket(): string {
    return this.config.get("s3.bucketName");
  }

  private resolvePrefix(prefix: string): string {
    if (!prefix) {
      const configuredPath = `${this.config.get("s3.bucketPath") ?? ""}`
        .replace(/^\/+|\/+$/g, "")
        .trim();
      return configuredPath ? `${configuredPath}/` : "";
    }

    const hasTrailingSlash = prefix.endsWith("/");
    const resolved = this.resolveKey(prefix.replace(/\/+$/, ""));
    return hasTrailingSlash ? `${resolved}/` : resolved;
  }

  private stripConfiguredPath(key: string): string {
    const configuredPath = `${this.config.get("s3.bucketPath") ?? ""}`
      .replace(/^\/+|\/+$/g, "")
      .trim();
    if (!configuredPath) return key;
    const prefix = `${configuredPath}/`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }

  private normalizeKey(key: string): string {
    const normalized = `${key}`.replace(/^\/+/, "");
    const hasControlCharacter = Array.from(normalized).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    });
    if (!normalized || hasControlCharacter) {
      throw new BadRequestException("Invalid storage object key");
    }

    const segments = normalized.split("/");
    if (
      segments.some(
        (segment) => !segment || segment === "." || segment === "..",
      )
    ) {
      throw new BadRequestException("Invalid storage object key");
    }

    return segments.join("/");
  }

  private validateChunk(chunk: StorageChunk) {
    if (
      !Number.isInteger(chunk.index) ||
      !Number.isInteger(chunk.total) ||
      chunk.total < 1 ||
      chunk.index < 0 ||
      chunk.index >= chunk.total
    ) {
      throw new BadRequestException("Invalid storage chunk");
    }
  }

  private parseParts(value: string): MultipartPart[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new InternalServerErrorException("Invalid multipart upload state");
    }
  }

  private toBuffer(data: string | Buffer): Buffer {
    return Buffer.isBuffer(data) ? data : Buffer.from(data, "base64");
  }

  private async abortRemoteMultipart(objectKey: string, uploadId: string) {
    await this.getClient().send(
      new AbortMultipartUploadCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
        UploadId: uploadId,
      }),
    );
  }
}
