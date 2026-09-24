import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShareService } from "./share.service";

function createPrismaMock(records: { shares?: any[] } = {}) {
  const shares = records.shares ?? [];
  const calls: any[] = [];

  return {
    calls,
    prisma: {
      asset: {
        findFirst: async (args: any) => {
          calls.push(["asset.findFirst", args]);
          return (
            shares
              .flatMap((share) => share.assets ?? [])
              .find((asset) =>
                Object.entries(args.where).every(([key, value]) => {
                  return asset[key] === value;
                }),
              ) ?? null
          );
        },
      },
      share: {
        findFirst: async (args: any) => {
          calls.push(["share.findFirst", args]);
          return shares.find((item) => item.id === args.where.id) ?? null;
        },
        create: async (args: any) => {
          calls.push(["share.create", args]);
          const share = {
            ...args.data,
            id: args.data.id,
            views: 0,
          };
          shares.push(share);
          return share;
        },
        findUnique: async (args: any) => {
          calls.push(["share.findUnique", args]);
          const share = shares.find((item) => item.id === args.where.id);
          if (!share) return null;

          if (!args.include?.assets) return share;

          const assetFilter = args.include.assets.where?.type;
          return {
            ...share,
            assets: assetFilter
              ? share.assets.filter((asset: any) => asset.type === assetFilter)
              : share.assets,
          };
        },
        update: async (args: any) => {
          calls.push(["share.update", args]);
          const share = shares.find((item) => item.id === args.where.id);
          return share
            ? {
                ...share,
                views: args.data.views ?? share.views,
              }
            : null;
        },
      },
    },
  };
}

function createAssetServiceMock() {
  const calls: any[] = [];

  return {
    calls,
    service: {
      createText: async (data: any, owner: any, container: any) => {
        calls.push(["createText", data, owner, container]);
        return {
          id: "asset-text-2",
          type: "TEXT",
          content: data.content,
          shareId: container.id,
        };
      },
      createLink: async (data: any, owner: any, container: any) => {
        calls.push(["createLink", data, owner, container]);
        return {
          id: "asset-link-2",
          type: "LINK",
          url: data.url,
          shareId: container.id,
        };
      },
      remove: async (asset: any) => {
        calls.push(["remove", asset]);
      },
    },
  };
}

function createShareService(prisma: any, assetService: any, configGet?: any) {
  const config = { get: configGet ?? (() => false) };
  const jwtService = {
    sign: () => "share-token",
  };
  const reverseShareService = { getByToken: async () => null };
  const systemService = { getSystemInfo: async () => null };
  const i18n = { t: (key: string) => key };
  const accessPolicyCalls: any[] = [];
  const accessPolicyService = {
    recordView: async () => null,
    upsertForRelation: async (relation: any, input: any) => {
      accessPolicyCalls.push(["upsertForRelation", relation, input]);
      return { id: "policy-1", ...relation, ...input };
    },
  };

  const service = new (ShareService as any)(
    prisma,
    config,
    {},
    {},
    config,
    jwtService,
    reverseShareService,
    {},
    systemService,
    i18n,
    assetService,
    accessPolicyService,
  ) as ShareService;
  (service as any).__accessPolicyCalls = accessPolicyCalls;
  return service;
}

test("get returns all share assets while preserving the file compatibility projection", async () => {
  const { prisma } = createPrismaMock({
    shares: [
      {
        id: "share-1",
        uploadLocked: true,
        removedReason: null,
        security: null,
        assets: [
          {
            id: "asset-file-1",
            type: "FILE",
            name: "guide.pdf",
            size: "123",
            mimeType: "application/pdf",
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            shareId: "share-1",
          },
          {
            id: "asset-text-1",
            type: "TEXT",
            content: "Read me first",
            createdAt: new Date("2026-06-28T00:01:00.000Z"),
            shareId: "share-1",
          },
          {
            id: "asset-link-1",
            type: "LINK",
            url: "https://example.com/details",
            createdAt: new Date("2026-06-28T00:02:00.000Z"),
            shareId: "share-1",
          },
        ],
      },
    ],
  });
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);

  const share = await service.get("share-1");

  assert.deepEqual(
    share.assets.map((asset: any) => asset.type),
    ["FILE", "TEXT", "LINK"],
  );
  assert.deepEqual(share.files, [
    {
      id: "asset-file-1",
      name: "guide.pdf",
      size: "123",
      mimeType: "application/pdf",
      createdAt: new Date("2026-06-28T00:00:00.000Z"),
      shareId: "share-1",
    },
  ]);
});

test("addAsset creates text and link assets inside a share container", async () => {
  const { prisma } = createPrismaMock();
  const { calls, service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);
  const owner = { id: "user-1" };

  const text = await (service as any).addAsset(
    "share-1",
    { type: "TEXT", content: "Meeting notes" },
    owner,
  );
  const link = await (service as any).addAsset(
    "share-1",
    { type: "LINK", url: "https://example.com" },
    owner,
  );

  assert.equal(text.shareId, "share-1");
  assert.equal(link.shareId, "share-1");
  assert.deepEqual(calls, [
    ["createText", { content: "Meeting notes" }, owner, { id: "share-1" }],
    ["createLink", { url: "https://example.com" }, owner, { id: "share-1" }],
  ]);
});

test("addAsset rejects file assets because share file uploads use chunk routes", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);

  await assert.rejects(
    () =>
      (service as any).addAsset("share-1", { type: "FILE" }, { id: "user-1" }),
    BadRequestException,
  );
});

test("removeAsset removes an asset belonging to the share", async () => {
  const asset = {
    id: "asset-text-1",
    type: "TEXT",
    content: "Meeting notes",
    shareId: "share-1",
    roomId: null,
  };
  const { calls: prismaCalls, prisma } = createPrismaMock({
    shares: [{ id: "share-1", assets: [asset] }],
  });
  const { calls: assetCalls, service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);

  await (service as any).removeAsset("share-1", "asset-text-1");

  assert.deepEqual(prismaCalls[0], [
    "asset.findFirst",
    { where: { id: "asset-text-1", shareId: "share-1" } },
  ]);
  assert.deepEqual(assetCalls[0], ["remove", asset]);
});

test("removeAsset rejects assets outside the share", async () => {
  const { prisma } = createPrismaMock({
    shares: [
      {
        id: "share-2",
        assets: [{ id: "asset-text-1", type: "TEXT", shareId: "share-2" }],
      },
    ],
  });
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);

  await assert.rejects(
    () => (service as any).removeAsset("share-1", "asset-text-1"),
    NotFoundException,
  );
});

test("getShareToken rejects exhausted access policy view limits", async () => {
  const { prisma } = createPrismaMock({
    shares: [
      {
        id: "share-1",
        createdAt: new Date("2026-06-28T00:00:00.000Z"),
        expiration: new Date(0),
        views: 0,
        security: null,
        accessPolicy: {
          id: "policy-1",
          maxViews: 1,
          views: 1,
          oneTime: false,
        },
      },
    ],
  });
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService);

  await assert.rejects(
    () => service.getShareToken("share-1", undefined as any),
    ForbiddenException,
  );
});

const shareCreateConfig = (key: string) => {
  if (key === "share.maxExpiration") return { value: 0, unit: "days" };
  if (key === "s3.enabled") return false;
  return false;
};

test("create does not write an access policy without an accessControl payload", async () => {
  const { calls, prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService, shareCreateConfig);

  await service.create(
    { id: "share-new-1", expiration: "1-day", recipients: [] } as any,
    { id: "user-1" } as any,
  );

  assert.equal((service as any).__accessPolicyCalls.length, 0);
  assert.ok(calls.find(([name]) => name === "share.create"));
});

test("create upserts an access policy for the share when accessControl is sent", async () => {
  const { prisma } = createPrismaMock();
  const { service: assetService } = createAssetServiceMock();
  const service = createShareService(prisma, assetService, shareCreateConfig);

  await service.create(
    {
      id: "share-new-2",
      expiration: "1-day",
      recipients: [],
      accessControl: { password: "secret123", maxViews: 3 },
    } as any,
    { id: "user-1" } as any,
  );

  const policyCalls = (service as any).__accessPolicyCalls;
  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { shareId: "share-new-2" },
    { password: "secret123", maxViews: 3 },
  ]);
});
