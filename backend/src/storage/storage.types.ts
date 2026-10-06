import { Readable } from "stream";
import { StorageProvider } from "@prisma/client";

export type StorageChunk = {
  index: number;
  total: number;
};

export type StorageObject = {
  key: string;
  size: number;
  etag?: string;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
};

export type StorageObjectStream = StorageObject & {
  body: Readable;
  contentRange?: string;
};

export type StorageListResult = {
  objects: StorageObject[];
  prefixes: string[];
  continuationToken?: string;
};

export type StorageNamespace = {
  id: "assets" | "webdav";
  path: string;
};

export type StorageStatus = {
  provider: StorageProvider;
  s3: {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    rootPath: string;
  };
  namespaces: StorageNamespace[];
  webdav: {
    enabled: boolean;
    available: boolean;
    allowWrite: boolean;
    path: string;
    reason?: "disabled" | "requires_s3";
  };
};

export type StorageConnectionTest = {
  ok: boolean;
  provider: StorageProvider;
  latencyMs: number;
  checkedAt: string;
  error?: string;
};
