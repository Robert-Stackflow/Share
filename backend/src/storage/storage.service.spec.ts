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
  let storedObjects: Array<{
    key: string;
    size: number;
    lastModified?: Date;
  }> = [];
  return {
    getConfiguredRootPath: () => "tenant/root",
    resolveKey: (key: string) => `tenant/root/${key}`,
    assetKey: (key: string) => `assets/${key}`,
    webDavRootKey: (userId: string) => `dav/${userId}`,
    list,
    listAll: async () => storedObjects,
    setStoredObjects: (objects: typeof storedObjects) => {
      storedObjects = objects;
    },
    deleteMany: async (keys: string[]) => {
      const keySet = new Set(keys);
      storedObjects = storedObjects.filter((object) => !keySet.has(object.key));
      return keySet.size;
    },
    abortMultipartOlderThan: async () => 0,
  };
}

function createPrisma(
  assets: Array<{
    id: string;
    storage: StorageProvider | null;
    storageKey: string | null;
  }> = [],
  staleMultipartUploads = 0,
) {
  return {
    asset: { findMany: async () => assets },
    storageMultipartUpload: {
      count: async () => staleMultipartUploads,
    },
  };
}

test("describes the configured provider and isolated storage namespaces", () => {
  const service = new StorageService(
    createConfig() as any,
    createObjects() as any,
    createPrisma() as any,
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
    createPrisma() as any,
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
    createPrisma() as any,
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
    createPrisma() as any,
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
    createPrisma() as any,
  );

  const result = await service.testConnection();
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /bucket is unavailable/);
  assert.ok((result.error?.length ?? 0) <= 500);
});

test("summarizes the current user's isolated WebDAV objects", async () => {
  const objects = createObjects();
  objects.setStoredObjects([
    {
      key: "dav/user-1/documents/report.pdf",
      size: 1200,
      lastModified: new Date("2026-10-06T08:00:00.000Z"),
    },
    {
      key: "dav/user-1/photos/image.png",
      size: 800,
      lastModified: new Date("2026-10-07T08:00:00.000Z"),
    },
    { key: "dav/user-1/empty/.nepheleempty", size: 0 },
  ]);
  const service = new StorageService(
    createConfig() as any,
    objects as any,
    createPrisma() as any,
  );

  const usage = await service.getWebDavUsage("user-1");

  assert.equal(usage.available, true);
  assert.equal(usage.objectCount, 2);
  assert.equal(usage.totalBytes, 2000);
  assert.equal(usage.lastModified, "2026-10-07T08:00:00.000Z");
  assert.equal(usage.namespace, "tenant/root/dav/user-1");
});

test("audits orphaned, protected, missing, and stale S3 state", async () => {
  const objects = createObjects();
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  objects.setStoredObjects([
    { key: "assets/referenced", size: 100, lastModified: oldDate },
    { key: "assets/orphaned", size: 200, lastModified: oldDate },
    { key: "assets/recent", size: 300, lastModified: new Date() },
  ]);
  const service = new StorageService(
    createConfig() as any,
    objects as any,
    createPrisma(
      [
        {
          id: "referenced",
          storage: StorageProvider.S3,
          storageKey: null,
        },
        { id: "missing", storage: StorageProvider.S3, storageKey: null },
      ],
      2,
    ) as any,
  );

  const audit = await service.auditStorage();

  assert.equal(audit.objects.count, 3);
  assert.equal(audit.objects.totalBytes, 600);
  assert.equal(audit.database.referencedObjects, 2);
  assert.deepEqual(audit.orphaned, {
    count: 1,
    totalBytes: 200,
    samples: ["assets/orphaned"],
  });
  assert.equal(audit.protectedUnreferenced.count, 1);
  assert.deepEqual(audit.missing.samples, ["assets/missing"]);
  assert.equal(audit.staleMultipartUploads, 2);
});

test("cleans only protected-age orphans and stale multipart uploads", async () => {
  const objects = createObjects();
  const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  objects.setStoredObjects([
    { key: "assets/referenced", size: 100, lastModified: oldDate },
    { key: "assets/orphaned", size: 200, lastModified: oldDate },
    { key: "assets/recent", size: 300, lastModified: new Date() },
  ]);
  let aborted = 0;
  objects.abortMultipartOlderThan = async () => {
    aborted++;
    return 2;
  };
  const prisma = createPrisma(
    [{ id: "referenced", storage: StorageProvider.S3, storageKey: null }],
    2,
  );
  const service = new StorageService(
    createConfig() as any,
    objects as any,
    prisma as any,
  );

  const result = await service.cleanupStorage();

  assert.equal(result.deletedOrphanedObjects, 1);
  assert.equal(result.abortedMultipartUploads, 2);
  assert.equal(aborted, 1);
  assert.equal(result.audit.objects.count, 2);
  assert.equal(result.audit.protectedUnreferenced.count, 1);
});
