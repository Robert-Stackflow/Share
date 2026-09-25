import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon from "argon2";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { RoomService } from "./room.service";

function createService(rooms: any[]) {
  const prisma = {
    room: {
      findFirst: async ({ where }: any) =>
        rooms.find((room) =>
          Object.entries(where).every(([key, value]) => room[key] === value),
        ) ?? null,
      findMany: async ({ where }: any) =>
        rooms.filter((room) => room.ownerId === where.ownerId),
    },
  };
  const assets = {
    createText: async ({ content }: any, user: any, room: any) => ({
      id: "new-asset",
      type: "TEXT",
      content,
      ownerId: user.id,
      roomId: room.id,
    }),
  };
  const config = { get: () => "local-test-secret" };
  const policy = { assertAllowed: () => true };
  return new RoomService(
    prisma as any,
    assets as any,
    new JwtService(),
    config as any,
    policy as any,
  );
}

test("private room stays visible to its owner and absent from visitor routes", async () => {
  const privateRoom = {
    id: "private-db",
    roomId: "private-id",
    visibility: "PRIVATE",
    ownerId: "owner",
    name: null,
    passcodeHash: null,
    assets: [{ id: "old-asset" }],
    accessPolicy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = createService([privateRoom]);
  const owned = await service.getOwned("private-id", "owner");
  assert.equal(owned.assets[0].id, "old-asset");
  assert.equal(owned.visibility, "PRIVATE");
  await assert.rejects(
    () => service.getOwned("private-id", "visitor"),
    NotFoundException,
  );
  await assert.rejects(
    () => service.open("private-id", undefined, "owner"),
    NotFoundException,
  );
  await assert.rejects(
    () => service.getForRead("private-id", undefined, "visitor"),
    NotFoundException,
  );
  await assert.rejects(
    () => service.remove("private-id", { id: "owner" } as any),
    ForbiddenException,
  );
});

test("visitor needs a valid passcode session before reading or writing", async () => {
  const room = {
    id: "shared-db",
    roomId: "shared-id",
    visibility: "SHARED",
    ownerId: "owner",
    name: "Shared",
    passcodeHash: await argon.hash("secret123"),
    assets: [],
    accessPolicy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const service = createService([room]);
  await assert.rejects(() => service.open("shared-id"), ForbiddenException);
  await assert.rejects(
    () => service.verifyPasscode("shared-id", "wrong"),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.getForRead("shared-id"),
    ForbiddenException,
  );
  await assert.rejects(
    () =>
      service.addAsset("shared-id", { type: "TEXT", content: "hello" }, {
        id: "visitor",
      } as any),
    ForbiddenException,
  );
  const token = await service.verifyPasscode(
    "shared-id",
    "secret123",
    "visitor",
  );
  assert.equal(
    (await service.getForRead("shared-id", token, "visitor")).roomId,
    "shared-id",
  );
  const asset = await service.addAsset(
    "shared-id",
    { type: "TEXT", content: "hello" },
    { id: "visitor" } as any,
    token,
  );
  assert.equal(asset.roomId, "shared-db");
  assert.equal(asset.ownerId, "visitor");
});

test("image preview keeps room access checks without granting file downloads", async () => {
  const room = {
    id: "shared-db",
    roomId: "shared-id",
    visibility: "SHARED",
    ownerId: "owner",
    passcodeHash: null,
    assets: [],
    accessPolicy: { allowDownload: false, oneTime: false, maxViews: null },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const image = {
    id: "image-id",
    type: "FILE",
    roomId: room.id,
    shareId: null,
    mimeType: "image/png",
    name: "photo.png",
    size: "128",
  };
  const prisma = {
    room: { findFirst: async () => room },
    asset: { findFirst: async () => image },
  };
  const stream = { metaData: { mimeType: "image/png" }, file: null };
  const assets = { getDownloadStream: async () => stream };
  const policy = {
    assertAllowed: (
      _policy: unknown,
      context: { requireDownload?: boolean },
    ) => {
      if (context.requireDownload)
        throw new ForbiddenException("Downloads disabled");
    },
  };
  const service = new RoomService(
    prisma as any,
    assets as any,
    new JwtService(),
    { get: () => "local-test-secret" } as any,
    policy as any,
  );

  await assert.rejects(
    () =>
      service.getFileDownload("shared-id", "image-id", undefined, "visitor"),
    ForbiddenException,
  );
  assert.equal(
    await service.getFileDownload(
      "shared-id",
      "image-id",
      undefined,
      "visitor",
      "image",
    ),
    stream,
  );
  image.name = "sample.json";
  image.size = "128";
  image.mimeType = "application/json";
  assert.equal(
    await service.getFileDownload(
      "shared-id",
      "image-id",
      undefined,
      "visitor",
      "text",
    ),
    stream,
  );
  image.size = String(1024 * 1024 + 1);
  await assert.rejects(
    () => service.getFileDownload("shared-id", "image-id", undefined, "visitor", "text"),
    BadRequestException,
  );
  image.name = "sample.pdf";
  image.mimeType = "application/pdf";
  assert.equal(
    await service.getFileDownload(
      "shared-id",
      "image-id",
      undefined,
      "visitor",
      "pdf",
    ),
    stream,
  );
  image.name = "unsafe.svg";
  image.size = "128";
  image.mimeType = "image/svg+xml";
  await assert.rejects(
    () =>
      service.getFileDownload(
        "shared-id",
        "image-id",
        undefined,
        "visitor",
        "image",
      ),
    BadRequestException,
  );
  assert.equal(
    await service.getFileDownload("shared-id", "image-id", undefined, "visitor", "text"),
    stream,
  );
});

test("bulk removal only removes selected assets from an owned room", async () => {
  const room = {
    id: "room-db",
    roomId: "room-id",
    ownerId: "owner",
    assets: [
      { id: "first", shareId: null },
      { id: "second", shareId: null },
      { id: "elsewhere", shareId: "share-id" },
    ],
  };
  const removed: string[] = [];
  const service = new RoomService(
    {
      room: {
        findFirst: async ({ where }: { where: { ownerId: string } }) =>
          where.ownerId === "owner" ? room : null,
      },
    } as any,
    { remove: async (asset: { id: string }) => removed.push(asset.id) } as any,
    new JwtService(),
    {} as any,
    {} as any,
  );
  await assert.rejects(
    () => service.removeAssets("room-id", { id: "visitor" } as any),
    NotFoundException,
  );
  assert.deepEqual(removed, []);
  assert.deepEqual(
    await service.removeAssets("room-id", { id: "owner" } as any, ["second"]),
    { deletedIds: ["second"] },
  );
  assert.deepEqual(removed, ["second"]);
});
