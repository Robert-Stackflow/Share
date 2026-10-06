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

export default {
  getSystemInfo,
  getStorageStatus,
  testStorageConnection,
};
