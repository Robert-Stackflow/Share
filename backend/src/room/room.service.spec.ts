import { ForbiddenException, NotFoundException } from "@nestjs/common";
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
