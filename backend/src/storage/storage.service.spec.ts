import { StorageProvider } from "@prisma/client";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { StorageService } from "./storage.service";

function createConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "s3.enabled": true,
    "s3.endpoint": "https://s3.example.com",
    "s3.region": "auto",
    "s3.bucketName": "share",
    "webdav.enabled": true,
    "webdav.allowWrite": true,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

function createObjects(list = async () => ({ objects: [], prefixes: [] })) {
  return {
    getConfiguredRootPath: () => "tenant/root",
    resolveKey: (key: string) => `tenant/root/${key}`,
    webDavRootKey: (userId: string) => `dav/${userId}`,
    list,
  };
}

test("describes the configured provider and isolated storage namespaces", () => {
  const service = new StorageService(
    createConfig() as any,
    createObjects() as any,
  );

  assert.deepEqual(service.getStatus(), {
    provider: StorageProvider.S3,
    s3: {
      enabled: true,
      endpoint: "https://s3.example.com",
      region: "auto",
      bucket: "share",
      rootPath: "tenant/root",
    },
    namespaces: [
      { id: "assets", path: "tenant/root/assets" },
      { id: "webdav", path: "tenant/root/dav/{userId}" },
    ],
    webdav: {
      enabled: true,
      available: true,
      allowWrite: true,
      path: "/dav/",
    },
  });
});

test("reports why WebDAV is unavailable without S3", () => {
  const service = new StorageService(
    createConfig({ "s3.enabled": false }) as any,
    createObjects() as any,
  );

  const status = service.getStatus();
  assert.equal(status.provider, StorageProvider.LOCAL);
  assert.equal(status.webdav.available, false);
  assert.equal(status.webdav.reason, "requires_s3");
});

test("tests the active S3 connection without exposing credentials", async () => {
  let calls = 0;
  const service = new StorageService(
    createConfig() as any,
    createObjects(async () => {
      calls++;
      return { objects: [], prefixes: [] };
    }) as any,
  );

  const result = await service.testConnection();
  assert.equal(result.ok, true);
  assert.equal(result.provider, StorageProvider.S3);
  assert.equal(calls, 1);
  assert.equal("credentials" in result, false);
});

test("can test S3 settings before S3 becomes the active provider", async () => {
  let calls = 0;
  const service = new StorageService(
    createConfig({ "s3.enabled": false }) as any,
    createObjects(async () => {
      calls++;
      return { objects: [], prefixes: [] };
    }) as any,
  );

  const result = await service.testConnection(StorageProvider.S3);
  assert.equal(result.ok, true);
  assert.equal(result.provider, StorageProvider.S3);
  assert.equal(calls, 1);
});

test("returns a bounded diagnostic when the S3 connection fails", async () => {
  const service = new StorageService(
    createConfig() as any,
    createObjects(async () => {
      throw new Error("bucket is unavailable");
    }) as any,
  );

  const result = await service.testConnection();
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /bucket is unavailable/);
  assert.ok((result.error?.length ?? 0) <= 500);
});
