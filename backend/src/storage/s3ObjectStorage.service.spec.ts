import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { BadRequestException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { S3ObjectStorageService } from "./s3ObjectStorage.service";

function createConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "s3.endpoint": "https://s3.example.com",
    "s3.region": "auto",
    "s3.key": "access-key",
    "s3.secret": "secret-key",
    "s3.forcePathStyle": true,
    "s3.useChecksum": false,
    "s3.bucketName": "share",
    "s3.bucketPath": "tenant/root",
    ...overrides,
  };

  return { get: (key: string) => values[key] };
}

function createPrisma() {
  const uploads = new Map<string, any>();

  return {
    uploads,
    prisma: {
      storageMultipartUpload: {
        create: async ({ data }: { data: any }) => {
          const record = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          uploads.set(data.id, record);
          return record;
        },
        findUnique: async ({ where }: { where: { id: string } }) =>
          uploads.get(where.id) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: any;
        }) => {
          const record = {
            ...uploads.get(where.id),
            ...data,
            updatedAt: new Date(),
          };
          uploads.set(where.id, record);
          return record;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const record = uploads.get(where.id);
          uploads.delete(where.id);
          return record;
        },
        deleteMany: async ({ where }: { where: { id: string } }) => {
          const deleted = uploads.delete(where.id);
          return { count: deleted ? 1 : 0 };
        },
        findMany: async () => [],
      },
    },
  };
}

function attachClient(
  service: S3ObjectStorageService,
  send: (command: unknown) => Promise<any>,
) {
  (service as any).client = { send, destroy: () => undefined };
  (service as any).clientSignature = JSON.stringify(
    service.getS3ClientConfig(),
  );
}

test("resolves object keys inside the configured bucket path", () => {
  const { prisma } = createPrisma();
  const service = new S3ObjectStorageService(
    createConfig() as any,
    prisma as any,
  );

  assert.equal(
    service.resolveKey("assets/file-id"),
    "tenant/root/assets/file-id",
  );
  assert.equal(service.assetKey("file-id"), "assets/file-id");
});

test("rejects traversal, empty path segments, and control characters", () => {
  const { prisma } = createPrisma();
  const service = new S3ObjectStorageService(
    createConfig() as any,
    prisma as any,
  );

  for (const key of ["../secret", "folder//file", "folder/./file", "a\0b"]) {
    assert.throws(() => service.resolveKey(key), BadRequestException);
  }
});

test("persists multipart state so another service instance can finish it", async () => {
  const config = createConfig();
  const { prisma, uploads } = createPrisma();
  const commands: unknown[] = [];
  const send = async (command: unknown) => {
    commands.push(command);
    if (command instanceof CreateMultipartUploadCommand) {
      return { UploadId: "upload-1" };
    }
    if (command instanceof UploadPartCommand) {
      return { ETag: `etag-${command.input.PartNumber}` };
    }
    return {};
  };

  const first = new S3ObjectStorageService(config as any, prisma as any);
  attachClient(first, send);
  await first.saveChunk(
    "asset-1",
    first.assetKey("asset-1"),
    Buffer.from("first"),
    { index: 0, total: 2 },
  );

  assert.equal(uploads.size, 1);
  assert.deepEqual(JSON.parse(uploads.get("asset-1").parts), [
    { ETag: "etag-1", PartNumber: 1 },
  ]);

  const afterRestart = new S3ObjectStorageService(config as any, prisma as any);
  attachClient(afterRestart, send);
  await afterRestart.saveChunk(
    "asset-1",
    afterRestart.assetKey("asset-1"),
    Buffer.from("second"),
    { index: 1, total: 2 },
  );

  assert.equal(uploads.size, 0);
  const complete = commands.find(
    (command) => command instanceof CompleteMultipartUploadCommand,
  ) as CompleteMultipartUploadCommand;
  assert.deepEqual(complete.input.MultipartUpload?.Parts, [
    { ETag: "etag-1", PartNumber: 1 },
    { ETag: "etag-2", PartNumber: 2 },
  ]);
});

test("lists every object page under a logical namespace", async () => {
  const { prisma } = createPrisma();
  const service = new S3ObjectStorageService(
    createConfig() as any,
    prisma as any,
  );
  let page = 0;
  attachClient(service, async (command) => {
    assert.ok(command instanceof ListObjectsV2Command);
    page++;
    return page === 1
      ? {
          Contents: [
            {
              Key: "tenant/root/assets/first",
              Size: 10,
              LastModified: new Date("2026-10-01T00:00:00Z"),
            },
          ],
          NextContinuationToken: "next-page",
        }
      : {
          Contents: [{ Key: "tenant/root/assets/second", Size: 20 }],
        };
  });

  const objects = await service.listAll("assets/");

  assert.deepEqual(
    objects.map((object) => object.key),
    ["assets/first", "assets/second"],
  );
  assert.equal(page, 2);
});

test("deletes logical object keys in a validated batch", async () => {
  const { prisma } = createPrisma();
  const service = new S3ObjectStorageService(
    createConfig() as any,
    prisma as any,
  );
  let command: DeleteObjectsCommand | undefined;
  attachClient(service, async (nextCommand) => {
    command = nextCommand as DeleteObjectsCommand;
    return {};
  });

  const deleted = await service.deleteMany([
    "assets/first",
    "assets/second",
    "assets/first",
  ]);

  assert.equal(deleted, 2);
  assert.ok(command instanceof DeleteObjectsCommand);
  assert.deepEqual(command.input.Delete?.Objects, [
    { Key: "tenant/root/assets/first" },
    { Key: "tenant/root/assets/second" },
  ]);
});
