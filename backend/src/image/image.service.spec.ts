import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AssetType, ImageVisibility, StorageProvider } from "@prisma/client";
import * as sharp from "sharp";
import { ImageService } from "./image.service";

const user = {
  id: "user-1",
  username: "chewie",
  email: "chewie@example.com",
};

const asset = {
  id: "asset-1",
  createdAt: new Date("2026-10-06T00:00:00.000Z"),
  type: AssetType.FILE,
  ownerId: user.id,
  shareId: null,
  roomId: null,
  roomBatchId: null,
  inboxSubmissionId: null,
  name: "pixel.png",
  size: "91",
  mimeType: "image/png",
  storage: StorageProvider.S3,
  storageKey: null,
  content: null,
  url: null,
  favorite: false,
  source: "UPLOAD",
  lastAccessedAt: null,
};

const createConfig = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    "images.uploadEnabled": true,
    "images.apiUploadEnabled": true,
    "images.allowPublic": true,
    "images.defaultPublic": true,
    "images.maxSize": 25 * 1024 * 1024,
    "images.maxPixels": 40_000_000,
    "images.allowProcessing": false,
    "images.uploadsPerMinute": 30,
    "images.userQuota": 0,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
};

const preference = {
  userId: user.id,
  createdAt: new Date("2026-10-06T00:00:00.000Z"),
  updatedAt: new Date("2026-10-06T00:00:00.000Z"),
  defaultVisibility: ImageVisibility.PUBLIC,
  autoOrient: false,
  stripMetadata: false,
  outputFormat: "ORIGINAL",
  quality: 82,
  maxWidth: null,
  deduplicate: false,
  watermarkEnabled: false,
  watermarkText: null,
  watermarkOpacity: 30,
  watermarkPosition: "southeast",
};

test("uploads a validated image through the asset storage layer", async () => {
  const uploads: unknown[][] = [];
  const createdImages: any[] = [];
  const assets = {
    createFile: async (...args: unknown[]) => {
      uploads.push(args);
      return asset;
    },
    removeOwned: async () => undefined,
  };
  const prisma = {
    hostedImage: {
      findUnique: async () => null,
      findFirst: async () => createdImages[0] ?? null,
      count: async () => 0,
      create: async ({ data }: any) => {
        const image = {
          id: "image-1",
          createdAt: new Date("2026-10-06T00:00:00.000Z"),
          updatedAt: new Date("2026-10-06T00:00:00.000Z"),
          assetId: asset.id,
          asset,
          ...data,
        };
        createdImages.push(image);
        return image;
      },
    },
    imagePreference: {
      findUnique: async () => preference,
    },
    asset: { update: async () => asset },
  };
  const service = new ImageService(
    prisma as any,
    assets as any,
    createConfig() as any,
  );
  (service as any).createThumbnail = async () => ({ asset });
  const buffer = await sharp({
    create: {
      width: 2,
      height: 3,
      channels: 4,
      background: "#ff0000",
    },
  })
    .png()
    .toBuffer();

  const image = await service.upload(
    {
      buffer,
      size: buffer.length,
      originalname: "pixel.png",
      mimetype: "image/png",
    } as Express.Multer.File,
    user as any,
    ImageVisibility.PUBLIC,
  );

  assert.equal(uploads.length, 1);
  assert.deepEqual(uploads[0].slice(1), [
    { index: 0, total: 1 },
    { name: "pixel.png" },
    user,
  ]);
  assert.equal(image.width, 2);
  assert.equal(image.height, 3);
  assert.equal(image.visibility, ImageVisibility.PUBLIC);
  assert.match(image.checksum, /^[a-f0-9]{64}$/);
  assert.match(image.slug, /^[A-Za-z0-9]{12}$/);
  assert.equal(createdImages.length, 1);
});

test("rejects active image formats such as SVG", async () => {
  const service = new ImageService({} as any, {} as any, createConfig() as any);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
  );

  await assert.rejects(
    service.upload(
      {
        buffer: svg,
        size: svg.length,
        originalname: "pixel.svg",
        mimetype: "image/svg+xml",
      } as Express.Multer.File,
      user as any,
    ),
    /Only JPEG, PNG, WebP, GIF and AVIF images are supported/,
  );
});

test("returns copy-ready links only for public images", () => {
  const service = new ImageService({} as any, {} as any, createConfig() as any);
  const hostedImage = {
    id: "image-1",
    createdAt: new Date("2026-10-06T00:00:00.000Z"),
    updatedAt: new Date("2026-10-06T00:00:00.000Z"),
    assetId: asset.id,
    asset: { ...asset, name: 'pixel "red".png' },
    slug: "AbCdEf012345",
    visibility: ImageVisibility.PUBLIC,
    width: 2,
    height: 3,
    checksum: "a".repeat(64),
  };

  const publicResponse = service.toResponse(
    hostedImage as any,
    "https://storage.example.com",
  );
  assert.equal(
    publicResponse.url,
    "https://storage.example.com/i/AbCdEf012345",
  );
  assert.match(publicResponse.links.html, /&quot;red&quot;/);

  const privateResponse = service.toResponse(
    { ...hostedImage, visibility: ImageVisibility.PRIVATE } as any,
    "https://storage.example.com",
  );
  assert.equal(privateResponse.url, null);
  assert.equal(privateResponse.links, null);

  const adminResponse = service.toResponse(
    { ...hostedImage, visibility: ImageVisibility.PRIVATE } as any,
    "https://storage.example.com",
    { admin: true },
  );
  assert.equal(
    adminResponse.thumbnailUrl,
    "/api/admin/images/image-1/thumbnail",
  );
});

test("applies administrator upload and visibility policies", async () => {
  const image = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();
  const file = {
    buffer: image,
    size: image.length,
    originalname: "pixel.png",
    mimetype: "image/png",
  } as Express.Multer.File;

  const disabled = new ImageService(
    {} as any,
    {} as any,
    createConfig({ "images.uploadEnabled": false }) as any,
  );
  await assert.rejects(disabled.upload(file, user as any), /disabled/);

  const privateOnly = new ImageService(
    {
      imagePreference: { findUnique: async () => preference },
    } as any,
    {} as any,
    createConfig({ "images.allowPublic": false }) as any,
  );
  assert.equal(
    (privateOnly as any).resolveVisibility(undefined),
    ImageVisibility.PRIVATE,
  );
  await assert.rejects(
    privateOnly.upload(file, user as any, ImageVisibility.PUBLIC),
    /Public image links are disabled/,
  );
});

test("returns owner-scoped image statistics", async () => {
  const prisma = {
    $queryRaw: async () => [
      {
        count: 2n,
        publicCount: 1n,
        privateCount: 1n,
        totalSize: 3072n,
        views: 7n,
      },
    ],
  };
  const service = new ImageService(
    prisma as any,
    {} as any,
    createConfig() as any,
  );

  assert.deepEqual(await service.stats(user.id), {
    count: 2,
    publicCount: 1,
    privateCount: 1,
    totalSize: 3072,
    views: 7,
  });
});

test("resizes and converts still images according to user preferences", async () => {
  const service = new ImageService(
    {} as any,
    {} as any,
    createConfig({ "images.allowProcessing": true }) as any,
  );
  const buffer = await sharp({
    create: {
      width: 8,
      height: 4,
      channels: 4,
      background: "#336699",
    },
  })
    .png()
    .toBuffer();

  const processed = await (service as any).processImage(
    buffer,
    "image/png",
    1,
    {
      ...preference,
      autoOrient: true,
      stripMetadata: true,
      outputFormat: "WEBP",
      quality: 75,
      maxWidth: 4,
    },
  );

  assert.equal(processed.transformed, true);
  assert.equal(processed.mimeType, "image/webp");
  assert.equal(processed.width, 4);
  assert.equal(processed.height, 2);
  assert.equal((await sharp(processed.buffer).metadata()).format, "webp");
});

test("paginates image queries with owner and organization filters", async () => {
  let receivedQuery: any;
  const images = ["image-1", "image-2", "image-3"].map((id) => ({
    id,
    asset: { ...asset, id: `asset-${id}` },
  }));
  const service = new ImageService(
    {
      hostedImage: {
        findMany: async (query: any) => {
          receivedQuery = query;
          return images;
        },
      },
    } as any,
    {} as any,
    createConfig() as any,
  );

  const page = await service.list(user.id, {
    albumId: "album-1",
    tag: "docs",
    favorite: true,
    limit: 2,
  });

  assert.deepEqual(
    page.items.map((image) => image.id),
    ["image-1", "image-2"],
  );
  assert.equal(page.nextCursor, "image-2");
  assert.equal(receivedQuery.take, 3);
  assert.equal(receivedQuery.where.albumId, "album-1");
  assert.equal(receivedQuery.where.asset.ownerId, user.id);
  assert.equal(receivedQuery.where.asset.favorite, true);
  assert.equal(receivedQuery.where.asset.tagAssignments.some.tag.name, "docs");
});

test("deduplicates only within the requested visibility and album", async () => {
  let duplicateQuery: any;
  const existing = {
    id: "image-existing",
    asset,
    visibility: ImageVisibility.PRIVATE,
    albumId: null,
  };
  const service = new ImageService(
    {
      imagePreference: {
        findUnique: async () => ({ ...preference, deduplicate: true }),
      },
      hostedImage: {
        findFirst: async (query: any) => {
          duplicateQuery = query;
          return existing;
        },
      },
    } as any,
    {} as any,
    createConfig() as any,
  );
  const buffer = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: "#123456",
    },
  })
    .png()
    .toBuffer();

  const result = await service.upload(
    {
      buffer,
      size: buffer.length,
      originalname: "private.png",
      mimetype: "image/png",
    } as Express.Multer.File,
    user as any,
    ImageVisibility.PRIVATE,
  );

  assert.equal(result, existing);
  assert.equal(duplicateQuery.where.visibility, ImageVisibility.PRIVATE);
  assert.equal(duplicateQuery.where.albumId, null);
});
