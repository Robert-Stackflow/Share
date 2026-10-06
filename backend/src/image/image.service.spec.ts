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
    asset: { update: async () => asset },
  };
  const service = new ImageService(prisma as any, assets as any);
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
  const service = new ImageService({} as any, {} as any);
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
  const service = new ImageService({} as any, {} as any);
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
});
