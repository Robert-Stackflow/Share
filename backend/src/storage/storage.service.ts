import { Injectable } from "@nestjs/common";
import { AssetType, StorageProvider } from "@prisma/client";
import { constants as fsConstants } from "fs";
import * as fs from "fs/promises";
import { ConfigService } from "src/config/config.service";
import { ASSET_DIRECTORY, DATA_DIRECTORY } from "src/constants";
import { PrismaService } from "src/prisma/prisma.service";
import { S3ObjectStorageService } from "./s3ObjectStorage.service";
import {
  StorageAudit,
  StorageCleanupResult,
  StorageConnectionTest,
  StorageStatus,
  StorageWebDavUsage,
} from "./storage.types";

const STORAGE_MAINTENANCE_GRACE_MS = 24 * 60 * 60 * 1000;
const STORAGE_AUDIT_SAMPLE_LIMIT = 20;

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly objects: S3ObjectStorageService,
    private readonly prisma: PrismaService,
  ) {}

  getConfiguredProvider(): StorageProvider {
    return this.config.get("s3.enabled")
      ? StorageProvider.S3
      : StorageProvider.LOCAL;
  }

  getStatus(): StorageStatus {
    const provider = this.getConfiguredProvider();
    const webDavEnabled = this.config.get("webdav.enabled") === true;
    const webDavAvailable = webDavEnabled && provider === StorageProvider.S3;

    return {
      provider,
      s3: {
        enabled: provider === StorageProvider.S3,
        endpoint: `${this.config.get("s3.endpoint") ?? ""}`,
        region: `${this.config.get("s3.region") ?? ""}`,
        bucket: `${this.config.get("s3.bucketName") ?? ""}`,
        rootPath: this.objects.getConfiguredRootPath(),
      },
      namespaces:
        provider === StorageProvider.S3
          ? [
              { id: "assets", path: this.objects.resolveKey("assets") },
              {
                id: "webdav",
                path: this.objects.resolveKey(
                  this.objects.webDavRootKey("{userId}"),
                ),
              },
            ]
          : [
              { id: "assets", path: ASSET_DIRECTORY },
              { id: "webdav", path: "-" },
            ],
      webdav: {
        enabled: webDavEnabled,
        available: webDavAvailable,
        allowWrite: this.config.get("webdav.allowWrite") === true,
        path: "/dav/",
        ...(!webDavEnabled
          ? { reason: "disabled" as const }
          : provider !== StorageProvider.S3
            ? { reason: "requires_s3" as const }
            : {}),
      },
    };
  }

  async testConnection(
    requestedProvider?: StorageProvider,
  ): Promise<StorageConnectionTest> {
    const provider = requestedProvider ?? this.getConfiguredProvider();
    const startedAt = Date.now();

    try {
      if (provider === StorageProvider.S3) {
        await this.objects.list("", { maxKeys: 1 });
      } else {
        await fs.mkdir(DATA_DIRECTORY, { recursive: true });
        await fs.access(DATA_DIRECTORY, fsConstants.R_OK | fsConstants.W_OK);
      }

      return {
        ok: true,
        provider,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        provider,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        error: this.formatError(error),
      };
    }
  }

  async getWebDavUsage(userId: string): Promise<StorageWebDavUsage> {
    const status = this.getStatus();
    const logicalRoot = this.objects.webDavRootKey(userId);
    const namespace =
      status.provider === StorageProvider.S3
        ? this.objects.resolveKey(logicalRoot)
        : "-";

    if (!status.webdav.available) {
      return {
        available: false,
        allowWrite: status.webdav.allowWrite,
        path: status.webdav.path,
        namespace,
        objectCount: 0,
        totalBytes: 0,
        reason: status.webdav.reason,
      };
    }

    const placeholderSuffix = "/.nepheleempty";
    const storedObjects = (
      await this.objects.listAll(`${logicalRoot}/`)
    ).filter((object) => !object.key.endsWith(placeholderSuffix));
    let totalBytes = 0;
    let lastModified: Date | undefined;
    for (const object of storedObjects) {
      totalBytes += object.size;
      if (
        object.lastModified &&
        (!lastModified || object.lastModified > lastModified)
      ) {
        lastModified = object.lastModified;
      }
    }

    return {
      available: true,
      allowWrite: status.webdav.allowWrite,
      path: status.webdav.path,
      namespace,
      objectCount: storedObjects.length,
      totalBytes,
      ...(lastModified ? { lastModified: lastModified.toISOString() } : {}),
    };
  }

  async auditStorage(): Promise<StorageAudit> {
    return (await this.buildStorageAudit()).audit;
  }

  async cleanupStorage(): Promise<StorageCleanupResult> {
    const current = await this.buildStorageAudit();
    if (!current.audit.available) {
      return {
        deletedOrphanedObjects: 0,
        abortedMultipartUploads: 0,
        audit: current.audit,
      };
    }

    const deletedOrphanedObjects = await this.objects.deleteMany(
      current.orphanedKeys,
    );
    const abortedMultipartUploads = await this.objects.abortMultipartOlderThan(
      current.cutoff,
    );

    return {
      deletedOrphanedObjects,
      abortedMultipartUploads,
      audit: (await this.buildStorageAudit()).audit,
    };
  }

  private async buildStorageAudit(): Promise<{
    audit: StorageAudit;
    orphanedKeys: string[];
    cutoff: Date;
  }> {
    const provider = this.getConfiguredProvider();
    const cutoff = new Date(Date.now() - STORAGE_MAINTENANCE_GRACE_MS);
    const namespace =
      provider === StorageProvider.S3
        ? this.objects.resolveKey("assets")
        : ASSET_DIRECTORY;
    const unavailableAudit: StorageAudit = {
      available: false,
      provider,
      checkedAt: new Date().toISOString(),
      namespace,
      protectionCutoff: cutoff.toISOString(),
      objects: { count: 0, totalBytes: 0 },
      database: { referencedObjects: 0 },
      orphaned: { count: 0, totalBytes: 0, samples: [] },
      protectedUnreferenced: { count: 0, totalBytes: 0 },
      missing: { count: 0, samples: [] },
      staleMultipartUploads: 0,
      reason: "requires_s3",
    };

    if (provider !== StorageProvider.S3) {
      return { audit: unavailableAudit, orphanedKeys: [], cutoff };
    }

    const [storedObjects, fileAssets, staleMultipartUploads] =
      await Promise.all([
        this.objects.listAll("assets/"),
        this.prisma.asset.findMany({
          where: { type: AssetType.FILE },
          select: { id: true, storage: true, storageKey: true },
        }),
        this.prisma.storageMultipartUpload.count({
          where: { updatedAt: { lt: cutoff } },
        }),
      ]);

    const allReferencedKeys = new Set(
      fileAssets.map((asset) =>
        this.objects.assetKey(asset.storageKey ?? asset.id),
      ),
    );
    const s3ReferencedKeys = new Set(
      fileAssets
        .filter((asset) => asset.storage === StorageProvider.S3)
        .map((asset) => this.objects.assetKey(asset.storageKey ?? asset.id)),
    );
    const storedKeys = new Set(storedObjects.map((object) => object.key));
    const missingKeys = Array.from(s3ReferencedKeys).filter(
      (key) => !storedKeys.has(key),
    );
    const orphanedObjects = storedObjects.filter(
      (object) =>
        object.key.startsWith("assets/") &&
        object.key.length > "assets/".length &&
        !allReferencedKeys.has(object.key) &&
        Boolean(object.lastModified && object.lastModified < cutoff),
    );
    const orphanedKeys = new Set(orphanedObjects.map((object) => object.key));
    const protectedUnreferencedObjects = storedObjects.filter(
      (object) =>
        object.key.startsWith("assets/") &&
        object.key.length > "assets/".length &&
        !allReferencedKeys.has(object.key) &&
        !orphanedKeys.has(object.key),
    );
    const sumBytes = (items: typeof storedObjects) =>
      items.reduce((sum, object) => sum + object.size, 0);

    return {
      cutoff,
      orphanedKeys: Array.from(orphanedKeys),
      audit: {
        available: true,
        provider,
        checkedAt: new Date().toISOString(),
        namespace,
        protectionCutoff: cutoff.toISOString(),
        objects: {
          count: storedObjects.length,
          totalBytes: sumBytes(storedObjects),
        },
        database: { referencedObjects: s3ReferencedKeys.size },
        orphaned: {
          count: orphanedObjects.length,
          totalBytes: sumBytes(orphanedObjects),
          samples: orphanedObjects
            .slice(0, STORAGE_AUDIT_SAMPLE_LIMIT)
            .map((object) => object.key),
        },
        protectedUnreferenced: {
          count: protectedUnreferencedObjects.length,
          totalBytes: sumBytes(protectedUnreferencedObjects),
        },
        missing: {
          count: missingKeys.length,
          samples: missingKeys.slice(0, STORAGE_AUDIT_SAMPLE_LIMIT),
        },
        staleMultipartUploads,
      },
    };
  }

  private formatError(error: unknown): string {
    if (!(error instanceof Error)) return "Storage connection failed";
    const message = error.message.replace(/\s+/g, " ").trim();
    return `${error.name}: ${message || "Storage connection failed"}`.slice(
      0,
      500,
    );
  }
}
