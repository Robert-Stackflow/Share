import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Readable } from "stream";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AssetService } from "./asset.service";

function createPrismaMock(records: any[] = []) {
  const created: any[] = [];
  const calls: any = {};

  return {
    calls,
    created,
    prisma: {
      asset: {
        create: async ({ data }: { data: any }) => {
          created.push(data);
          return {
            id: `asset-${created.length}`,
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            ownerId: data.owner?.connect?.id ?? null,
            shareId: data.share?.connect?.id ?? null,
            ...data,
          };
        },
        findMany: async (args: any) => {
          calls.findMany = args;
          return records;
        },
        groupBy: async (args: any) => {
          calls.groupBy = args;
          return records;
        },
        findFirst: async (args: any) => {
          calls.findFirst = args;
          return (
            records.find((record) => {
              return Object.entries(args.where).every(([key, value]) => {
                return record[key] === value;
              });
            }) ?? null
          );
        },
        delete: async (args: any) => {
          calls.delete = args;
          return records.find((record) => record.id === args.where.id);
        },
      },
      assetTag: {
        findMany: async (args: any) => {
          calls.tagFindMany = args;
          return records;
        },
      },
    },
  };
}

function createStorageMock() {
  const calls: any[] = [];
  return {
    calls,
    storage: {
      saveChunk: async (
        assetId: string,
        data: string,
        chunk: { index: number; total: number },
      ) => {
        calls.push(["saveChunk", assetId, data, chunk]);
      },
      getSize: async (assetId: string) => {
        calls.push(["getSize", assetId]);
        return 11;
      },
      getStream: async (assetId: string) => {
        calls.push(["getStream", assetId]);
        return Readable.from(["hello"]);
      },
      remove: async (assetId: string) => {
        calls.push(["remove", assetId]);
      },
      copy: async (sourceId: string, targetId: string) => {
        calls.push(["copy", sourceId, targetId]);
      },
    },
  };
}

function createConfigMock(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
  };
}

const user = { id: "user-1" };
const fileId = "2c62c90a-b451-46cb-8830-3b3bf938af0b";

test("createText stores only text-specific fields", async () => {
  const { created, prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const asset = await service.createText({ content: "hello" }, user as any);

  assert.equal(asset.type, "TEXT");
  assert.equal(asset.content, "hello");
  assert.equal(asset.ownerId, "user-1");
  assert.deepEqual(created[0], {
    type: "TEXT",
    content: "hello",
    owner: { connect: { id: "user-1" } },
  });
});

test("createText rejects blank content", async () => {
  const { prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () => service.createText({ content: "   " }, user as any),
    BadRequestException,
  );
});

test("createLink stores only link-specific fields", async () => {
  const { created, prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const asset = await service.createLink(
    { url: "https://example.com/docs" },
    user as any,
  );

  assert.equal(asset.type, "LINK");
  assert.equal(asset.url, "https://example.com/docs");
  assert.equal(asset.ownerId, "user-1");
  assert.deepEqual(created[0], {
    type: "LINK",
    url: "https://example.com/docs",
    owner: { connect: { id: "user-1" } },
  });
});

test("createLink rejects invalid URLs", async () => {
  const { prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () => service.createLink({ url: "not a url" }, user as any),
    BadRequestException,
  );
});

test("listByOwner returns standalone owned assets newest first", async () => {
  const { calls, prisma } = createPrismaMock([
    {
      id: "asset-1",
      type: "TEXT",
      content: "hello",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
    },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const assets = await service.listByOwner("user-1");

  assert.equal(assets.length, 1);
  assert.deepEqual(calls.findMany, {
    where: {
      ownerId: "user-1",
      shareId: null,
      roomId: null,
      inboxSubmissionId: null,
    },
    orderBy: { createdAt: "desc" },
    include: { tagAssignments: { include: { tag: true } } },
  });
});

test("listByOwner filters by q substring over name, content, and url", async () => {
  const { calls, prisma } = createPrismaMock([]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.listByOwner("user-1", { q: "Road" });

  assert.deepEqual(calls.findMany.where, {
    ownerId: "user-1",
    shareId: null,
    roomId: null,
    inboxSubmissionId: null,
    OR: [
      { name: { contains: "Road" } },
      { content: { contains: "Road" } },
      { url: { contains: "Road" } },
    ],
  });
});

test("listByOwner filters by type, source, and favorite", async () => {
  const { calls, prisma } = createPrismaMock([]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.listByOwner("user-1", {
    type: "TEXT" as any,
    source: "UPLOAD" as any,
    favorite: true,
  });

  assert.deepEqual(calls.findMany.where, {
    ownerId: "user-1",
    shareId: null,
    roomId: null,
    inboxSubmissionId: null,
    type: "TEXT",
    source: "UPLOAD",
    favorite: true,
  });
});

test("listByOwner filters by tag name via tag assignments", async () => {
  const { calls, prisma } = createPrismaMock([]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.listByOwner("user-1", { tag: "docs" });

  assert.deepEqual(calls.findMany.where, {
    ownerId: "user-1",
    shareId: null,
    roomId: null,
    inboxSubmissionId: null,
    tagAssignments: { some: { tag: { name: "docs" } } },
  });
});

test("listByOwner maps sort options to Prisma orderBy", async () => {
  const { storage } = createStorageMock();

  const cases: Array<[any, any]> = [
    ["createdAt_desc", { createdAt: "desc" }],
    ["createdAt_asc", { createdAt: "asc" }],
    ["lastAccessedAt_desc", { lastAccessedAt: "desc" }],
    ["name_asc", { name: "asc" }],
    [undefined, { createdAt: "desc" }],
  ];

  for (const [sort, expected] of cases) {
    const { calls, prisma } = createPrismaMock([]);
    const service = new AssetService(prisma as any, storage as any);
    await service.listByOwner("user-1", { sort });
    assert.deepEqual(calls.findMany.orderBy, expected);
  }
});

test("listTags returns owner tags with assignment counts ordered by name", async () => {
  const { calls, prisma } = createPrismaMock([
    { id: "tag-1", name: "docs", _count: { assignments: 3 } },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const tags = await service.listTags("user-1");

  assert.equal(tags.length, 1);
  assert.equal(tags[0]._count.assignments, 3);
  assert.deepEqual(calls.tagFindMany, {
    where: { ownerId: "user-1" },
    include: { _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  });
});

test("getOwned returns an owned asset", async () => {
  const { prisma } = createPrismaMock([
    {
      id: "asset-1",
      type: "TEXT",
      content: "hello",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
    },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const asset = await service.getOwned("asset-1", "user-1");

  assert.equal(asset.id, "asset-1");
});

test("getOwned rejects missing or foreign assets", async () => {
  const { prisma } = createPrismaMock([
    {
      id: "asset-1",
      type: "TEXT",
      content: "hello",
      ownerId: "user-2",
      shareId: null,
      roomId: null,
    },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () => service.getOwned("asset-1", "user-1"),
    NotFoundException,
  );
});

test("removeOwned deletes only after owner lookup", async () => {
  const { calls, prisma } = createPrismaMock([
    {
      id: "asset-1",
      type: "TEXT",
      content: "hello",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
    },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.removeOwned("asset-1", "user-1");

  assert.deepEqual(calls.findFirst.where, {
    id: "asset-1",
    ownerId: "user-1",
    shareId: null,
    roomId: null,
  });
  assert.deepEqual(calls.delete, { where: { id: "asset-1" } });
});

test("remove deletes file bytes before deleting file asset metadata", async () => {
  const fileAsset = {
    id: "asset-file",
    type: "FILE",
    name: "note.txt",
    ownerId: "user-1",
    shareId: null,
    roomId: "room-1",
  };
  const { calls, prisma } = createPrismaMock([fileAsset]);
  const { calls: storageCalls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.remove(fileAsset as any);

  assert.deepEqual(storageCalls, [["remove", "asset-file"]]);
  assert.deepEqual(calls.delete, { where: { id: "asset-file" } });
});

test("remove deletes file bytes from the asset storage provider", async () => {
  const fileAsset = {
    id: "asset-file",
    type: "FILE",
    storage: "S3",
    name: "note.txt",
    ownerId: "user-1",
    shareId: null,
    roomId: "room-1",
  };
  const { calls, prisma } = createPrismaMock([fileAsset]);
  const { calls: localCalls, storage: localStorage } = createStorageMock();
  const { calls: s3Calls, storage: s3Storage } = createStorageMock();
  const service = new (AssetService as any)(
    prisma,
    localStorage,
    s3Storage,
    createConfigMock({ "s3.enabled": true }),
  ) as AssetService;

  await service.remove(fileAsset as any);

  assert.deepEqual(localCalls, []);
  assert.deepEqual(s3Calls, [["remove", "asset-file"]]);
  assert.deepEqual(calls.delete, { where: { id: "asset-file" } });
});

test("remove deletes non-file asset metadata without touching storage", async () => {
  const textAsset = {
    id: "asset-text",
    type: "TEXT",
    content: "hello",
    ownerId: "user-1",
    shareId: null,
    roomId: "room-1",
  };
  const { calls, prisma } = createPrismaMock([textAsset]);
  const { calls: storageCalls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await service.remove(textAsset as any);

  assert.deepEqual(storageCalls, []);
  assert.deepEqual(calls.delete, { where: { id: "asset-text" } });
});

test("createFile stores a file asset after the last chunk", async () => {
  const { created, prisma } = createPrismaMock();
  const { calls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const asset = await service.createFile(
    "aGVsbG8gd29ybGQ=",
    { index: 0, total: 1 },
    { id: fileId, name: "note.txt" },
    user as any,
  );

  assert.equal(asset.id, fileId);
  assert.equal(asset.name, "note.txt");
  assert.deepEqual(calls, [
    ["saveChunk", fileId, "aGVsbG8gd29ybGQ=", { index: 0, total: 1 }],
    ["getSize", fileId],
  ]);
  assert.deepEqual(created[0], {
    id: fileId,
    type: "FILE",
    name: "note.txt",
    size: "11",
    mimeType: "text/plain",
    storage: "LOCAL",
    owner: { connect: { id: "user-1" } },
  });
});

test("createFile stores S3 file assets when S3 is enabled", async () => {
  const { created, prisma } = createPrismaMock();
  const { calls: localCalls, storage: localStorage } = createStorageMock();
  const { calls: s3Calls, storage: s3Storage } = createStorageMock();
  const service = new (AssetService as any)(
    prisma,
    localStorage,
    s3Storage,
    createConfigMock({ "s3.enabled": true }),
  ) as AssetService;

  const asset = await service.createFile(
    "aGVsbG8gd29ybGQ=",
    { index: 0, total: 1 },
    { id: fileId, name: "note.txt" },
    user as any,
  );

  assert.equal(asset.id, fileId);
  assert.deepEqual(localCalls, []);
  assert.deepEqual(s3Calls, [
    ["saveChunk", fileId, "aGVsbG8gd29ybGQ=", { index: 0, total: 1 }],
    ["getSize", fileId],
  ]);
  assert.equal(created[0].storage, "S3");
});

test("createFile saves intermediate chunks without creating metadata", async () => {
  const { created, prisma } = createPrismaMock();
  const { calls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const asset = await service.createFile(
    "aGVsbG8=",
    { index: 0, total: 2 },
    { id: fileId, name: "note.txt" },
    user as any,
  );

  assert.deepEqual(asset, { id: fileId, name: "note.txt" });
  assert.deepEqual(calls, [
    ["saveChunk", fileId, "aGVsbG8=", { index: 0, total: 2 }],
  ]);
  assert.equal(created.length, 0);
});

test("getOwnedDownloadStream returns metadata and stream for file assets", async () => {
  const { prisma } = createPrismaMock([
    {
      id: fileId,
      type: "FILE",
      name: "note.txt",
      size: "11",
      mimeType: "text/plain",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
    },
  ]);
  const { calls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const result = await service.getOwnedDownloadStream(fileId, "user-1");

  assert.equal(result.metaData.name, "note.txt");
  assert.deepEqual(calls, [["getStream", fileId]]);
});

test("getDownloadStream returns metadata and stream for a provided file asset", async () => {
  const { prisma } = createPrismaMock();
  const { calls, storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const result = await service.getDownloadStream({
    id: fileId,
    type: "FILE",
    size: "11",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    mimeType: "text/plain",
    name: "note.txt",
  } as any);

  assert.equal(result.metaData.name, "note.txt");
  assert.deepEqual(calls, [["getStream", fileId]]);
});

test("getDownloadStream reads from the asset storage provider", async () => {
  const { prisma } = createPrismaMock();
  const { calls: localCalls, storage: localStorage } = createStorageMock();
  const { calls: s3Calls, storage: s3Storage } = createStorageMock();
  const service = new (AssetService as any)(
    prisma,
    localStorage,
    s3Storage,
    createConfigMock({ "s3.enabled": true }),
  ) as AssetService;

  const result = await service.getDownloadStream({
    id: fileId,
    type: "FILE",
    storage: "S3",
    size: "11",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    mimeType: "text/plain",
    name: "note.txt",
  } as any);

  assert.equal(result.metaData.name, "note.txt");
  assert.deepEqual(localCalls, []);
  assert.deepEqual(s3Calls, [["getStream", fileId]]);
});

test("getOwnedDownloadStream rejects non-file assets", async () => {
  const { prisma } = createPrismaMock([
    {
      id: "asset-1",
      type: "TEXT",
      content: "hello",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
    },
  ]);
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () => service.getOwnedDownloadStream("asset-1", "user-1"),
    BadRequestException,
  );
});

test("getDownloadStream rejects provided non-file assets", async () => {
  const { prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () =>
      service.getDownloadStream({
        id: "asset-1",
        type: "TEXT",
        content: "hello",
      } as any),
    BadRequestException,
  );
});

test("saveToLibrary copies an owned room file into the private library", async () => {
  const { prisma, created } = createPrismaMock();
  const { calls, storage } = createStorageMock();
  const source = {
    id: fileId,
    type: "FILE",
    name: "note.txt",
    size: "11",
    mimeType: "text/plain",
    storage: "LOCAL",
    source: "ROOM",
  };
  (prisma.asset as any).findFirst = async ({ where }: any) => {
    assert.deepEqual(where, {
      id: fileId,
      OR: [
        { room: { is: { ownerId: "user-1" } } },
        { share: { is: { creatorId: "user-1" } } },
      ],
    });
    return source;
  };
  const service = new AssetService(prisma as any, storage as any);

  const saved = await service.saveToLibrary(fileId, user as any);

  assert.equal(saved.ownerId, "user-1");
  assert.equal(saved.source, "ROOM");
  assert.equal(created[0].room, undefined);
  assert.equal(created[0].share, undefined);
  assert.deepEqual(calls, [["copy", fileId, created[0].id]]);
});

test("saveToLibrary rejects an asset outside owned rooms and shares", async () => {
  const { prisma } = createPrismaMock();
  const { calls, storage } = createStorageMock();
  (prisma.asset as any).findFirst = async () => null;
  const service = new AssetService(prisma as any, storage as any);

  await assert.rejects(
    () => service.saveToLibrary(fileId, user as any),
    NotFoundException,
  );
  assert.deepEqual(calls, []);
});
