import api from "./api.service";

export interface SystemInfo {
  used: number;
  total: number;
}

export interface StorageStatus {
  provider: "LOCAL" | "S3";
  s3: {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    rootPath: string;
  };
  namespaces: Array<{
    id: "assets" | "webdav";
    path: string;
  }>;
  webdav: {
    enabled: boolean;
    available: boolean;
    allowWrite: boolean;
    path: string;
    reason?: "disabled" | "requires_s3";
  };
}

export interface StorageConnectionTest {
  ok: boolean;
  provider: "LOCAL" | "S3";
  latencyMs: number;
  checkedAt: string;
  error?: string;
}

export interface StorageWebDavUsage {
  available: boolean;
  allowWrite: boolean;
  path: string;
  namespace: string;
  objectCount: number;
  totalBytes: number;
  lastModified?: string;
  reason?: "disabled" | "requires_s3";
}

export interface StorageAudit {
  available: boolean;
  provider: "LOCAL" | "S3";
  checkedAt: string;
  namespace: string;
  protectionCutoff: string;
  objects: { count: number; totalBytes: number };
  database: { referencedObjects: number };
  orphaned: { count: number; totalBytes: number; samples: string[] };
  protectedUnreferenced: { count: number; totalBytes: number };
  missing: { count: number; samples: string[] };
  staleMultipartUploads: number;
  reason?: "requires_s3";
}

export interface StorageCleanupResult {
  deletedOrphanedObjects: number;
  abortedMultipartUploads: number;
  audit: StorageAudit;
}

const getSystemInfo = async (): Promise<SystemInfo | null> => {
  return (await api.get("system/info")).data;
};

const getStorageStatus = async (): Promise<StorageStatus> => {
  return (await api.get("system/storage")).data;
};

const testStorageConnection = async (
  provider?: "S3",
): Promise<StorageConnectionTest> => {
  return (
    await api.post("system/storage/test", undefined, {
      params: provider ? { provider } : undefined,
    })
  ).data;
};

const getWebDavUsage = async (): Promise<StorageWebDavUsage> => {
  return (await api.get("system/storage/webdav/usage")).data;
};

const auditStorage = async (): Promise<StorageAudit> => {
  return (await api.post("system/storage/audit")).data;
};

const cleanupStorage = async (): Promise<StorageCleanupResult> => {
  return (await api.post("system/storage/cleanup")).data;
};

export default {
  auditStorage,
  cleanupStorage,
  getSystemInfo,
  getStorageStatus,
  getWebDavUsage,
  testStorageConnection,
};
