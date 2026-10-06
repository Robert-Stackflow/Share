import { Injectable } from "@nestjs/common";
import { StorageProvider } from "@prisma/client";
import { constants as fsConstants } from "fs";
import * as fs from "fs/promises";
import { ConfigService } from "src/config/config.service";
import { ASSET_DIRECTORY, DATA_DIRECTORY } from "src/constants";
import { S3ObjectStorageService } from "./s3ObjectStorage.service";
import { StorageConnectionTest, StorageStatus } from "./storage.types";

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly objects: S3ObjectStorageService,
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

  private formatError(error: unknown): string {
    if (!(error instanceof Error)) return "Storage connection failed";
    const message = error.message.replace(/\s+/g, " ").trim();
    return `${error.name}: ${message || "Storage connection failed"}`.slice(
      0,
      500,
    );
  }
}
