import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AssetService } from "./asset.service";

function matchesWhere(record: any, where: any) {
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

function createPrismaMock() {
  const assets: any[] = [
    {
      id: "asset-text",
      type: "TEXT",
      content: "hello",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
      source: "UPLOAD",
    },
    {
      id: "asset-link",
      type: "LINK",
      url: "https://example.com/docs",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
      source: "UPLOAD",
    },
    {
      id: "asset-file",
      type: "FILE",
      name: "note.txt",
      size: "42",
      mimeType: "text/plain",
      storage: "LOCAL",
      ownerId: "user-1",
      shareId: null,
      roomId: null,
      source: "UPLOAD",
    },
  ];
  const calls: any[] = [];
  const tags: any[] = [];

  return {
    assets,
    calls,
    prisma: {
      asset: {
        findFirst: async (args: any) => {
          calls.push(["asset.findFirst", args]);
          return assets.find((asset) => matchesWhere(asset, args.where)) ?? null;
        },
        create: async (args: any) => {
          calls.push(["asset.create", args]);
          const asset = {
            id: args.data.id ?? `asset-created-${assets.length + 1}`,
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            ownerId: args.data.owner?.connect?.id ?? null,
            shareId: args.data.share?.connect?.id ?? null,
            roomId: args.data.room?.connect?.id ?? null,
            inboxSubmissionId: args.data.inboxSubmission?.connect?.id ?? null,
            ...args.data,
          };
          assets.push(asset);
          return asset;
        },
        update: async (args: any) => {
          calls.push(["asset.update", args]);
          const asset = assets.find((item) => matchesWhere(item, args.where));
          Object.assign(asset, args.data);
          return asset;
        },
      },
      share: {
        create: async (args: any) => {
          calls.push(["share.create", args]);
          return {
            id: args.data.id,
            uploadLocked: args.data.uploadLocked,
            expiration: args.data.expiration,
          };
        },
      },
      room: {
        findFirst: async (args: any) => {
          calls.push(["room.findFirst", args]);
          if (args.where.roomId === "room-1" && args.where.ownerId === "user-1") {
            return { id: "room-db-1", roomId: "room-1", type: "ROOM" };
          }
          return null;
        },
      },
      assetTag: {
        upsert: async (args: any) => {
          calls.push(["assetTag.upsert", args]);
          const tag = {
            id: `tag-${tags.length + 1}`,
            ownerId: args.create.owner.connect.id,
            name: args.create.name,
          };
          tags.push(tag);
          return tag;
        },
      },
      assetTagAssignment: {
        deleteMany: async (args: any) => {
          calls.push(["assetTagAssignment.deleteMany", args]);
        },
        createMany: async (args: any) => {
          calls.push(["assetTagAssignment.createMany", args]);
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
      copy: async (sourceId: string, targetId: string) => {
        calls.push(["copy", sourceId, targetId]);
      },
      remove: async () => undefined,
      saveChunk: async () => undefined,
      getSize: async () => 0,
      getStream: async () => undefined,
    },
  };
}

function createShortLinkServiceMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      create: async (data: any, user: any) => {
        calls.push(["create", data, user]);
        return { id: "short-link-1", code: data.code ?? "abc123", ...data };
      },
    },
  };
}

const user = { id: "user-1" };
const config = {
  get: (key: string) => {
    if (key === "s3.enabled") return false;
    if (key === "share.defaultExpiration") return { value: 7, unit: "days" };
    return null;
  },
};

test("cloneOwned copies file storage and creates a standalone cloned asset", async () => {
  const { prisma } = createPrismaMock();
  const { calls: storageCalls, storage } = createStorageMock();
  const { service: shortLinkService } = createShortLinkServiceMock();
  const service = new AssetService(
    prisma as any,
    storage as any,
    undefined,
    config as any,
    shortLinkService as any,
  );

  const clone = await service.cloneOwned("asset-file", user as any);

  assert.equal(clone.type, "FILE");
  assert.equal(clone.ownerId, "user-1");
  assert.equal(clone.source, "UPLOAD");
  assert.deepEqual(storageCalls[0], ["copy", "asset-file", clone.id]);
});

test("createShareFromAsset creates a completed single-asset share with a cloned asset", async () => {
  const { calls, prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const { service: shortLinkService } = createShortLinkServiceMock();
  const service = new AssetService(
    prisma as any,
    storage as any,
    undefined,
    config as any,
    shortLinkService as any,
  );

  const result = await service.createShareFromAsset("asset-text", user as any);

  assert.equal(result.share.uploadLocked, true);
  assert.equal(result.asset.shareId, result.share.id);
  assert.equal(result.asset.source, "SHARE");
  assert.ok(calls.find(([name]) => name === "share.create"));
});

test("createShortLinkFromAsset links LINK assets directly and shares TEXT assets first", async () => {
  const { prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const { calls: shortLinkCalls, service: shortLinkService } =
    createShortLinkServiceMock();
  const service = new AssetService(
    prisma as any,
    storage as any,
    undefined,
    config as any,
    shortLinkService as any,
  );

  await service.createShortLinkFromAsset("asset-link", user as any);
  await service.createShortLinkFromAsset("asset-text", user as any);

  assert.deepEqual(shortLinkCalls[0], [
    "create",
    {
      targetType: "URL",
      targetUrl: "https://example.com/docs",
      title: "https://example.com/docs",
    },
    user,
  ]);
  assert.equal(shortLinkCalls[1][1].targetType, "INTERNAL_PATH");
  assert.match(shortLinkCalls[1][1].targetUrl, /^\/s\//);
});

test("sendToRoom clones an owned asset into an owned room", async () => {
  const { prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const { service: shortLinkService } = createShortLinkServiceMock();
  const service = new AssetService(
    prisma as any,
    storage as any,
    undefined,
    config as any,
    shortLinkService as any,
  );

  const clone = await service.sendToRoom("asset-text", "room-1", user as any);

  assert.equal(clone.roomId, "room-db-1");
  assert.equal(clone.source, "ROOM");
});

test("updateOwned updates favorite state and replaces tag assignments", async () => {
  const { calls, prisma } = createPrismaMock();
  const { storage } = createStorageMock();
  const service = new AssetService(prisma as any, storage as any);

  const updated = await service.updateOwned("asset-text", "user-1", {
    favorite: true,
    tags: ["docs", "notes"],
  });

  assert.equal(updated.favorite, true);
  assert.ok(calls.find(([name]) => name === "asset.update"));
  assert.deepEqual(
    calls.find(([name]) => name === "assetTagAssignment.deleteMany"),
    ["assetTagAssignment.deleteMany", { where: { assetId: "asset-text" } }],
  );
  assert.deepEqual(
    calls.find(([name]) => name === "assetTagAssignment.createMany"),
    [
      "assetTagAssignment.createMany",
      {
        data: [
          { assetId: "asset-text", tagId: "tag-1" },
          { assetId: "asset-text", tagId: "tag-2" },
        ],
      },
    ],
  );
});
