import { BadRequestException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AssetController } from "./asset.controller";

const user = { id: "user-1" };

function createServiceMock() {
  const calls: any[] = [];

  return {
    calls,
    service: {
      createText: async (body: any, currentUser: any) => {
        calls.push(["createText", body, currentUser]);
        return { id: "asset-text", type: "TEXT", ...body };
      },
      createLink: async (body: any, currentUser: any) => {
        calls.push(["createLink", body, currentUser]);
        return { id: "asset-link", type: "LINK", ...body };
      },
      createFile: async (
        data: string,
        chunk: { index: number; total: number },
        file: { id?: string; name: string },
        currentUser: any,
      ) => {
        calls.push(["createFile", data, chunk, file, currentUser]);
        return { id: file.id ?? "asset-file", type: "FILE", name: file.name };
      },
      listByOwner: async (ownerId: string, filters?: any) => {
        calls.push(["listByOwner", ownerId, filters]);
        return [{ id: "asset-1", type: "TEXT" }];
      },
      listTags: async (ownerId: string) => {
        calls.push(["listTags", ownerId]);
        return [{ id: "tag-1", name: "docs", _count: { assignments: 1 } }];
      },
      getOwned: async (assetId: string, ownerId: string) => {
        calls.push(["getOwned", assetId, ownerId]);
        return { id: assetId, type: "TEXT" };
      },
      removeOwned: async (assetId: string, ownerId: string) => {
        calls.push(["removeOwned", assetId, ownerId]);
      },
      updateOwned: async (assetId: string, ownerId: string, body: any) => {
        calls.push(["updateOwned", assetId, ownerId, body]);
        return { id: assetId, type: "TEXT", ...body };
      },
      cloneOwned: async (assetId: string, currentUser: any) => {
        calls.push(["cloneOwned", assetId, currentUser]);
        return { id: "asset-clone", clonedFrom: assetId };
      },
      createShareFromAsset: async (assetId: string, currentUser: any) => {
        calls.push(["createShareFromAsset", assetId, currentUser]);
        return { share: { id: "share-1" }, asset: { id: "asset-share" } };
      },
      createShortLinkFromAsset: async (assetId: string, currentUser: any) => {
        calls.push(["createShortLinkFromAsset", assetId, currentUser]);
        return { id: "short-link-1", code: "abc123" };
      },
      sendToRoom: async (assetId: string, roomId: string, currentUser: any) => {
        calls.push(["sendToRoom", assetId, roomId, currentUser]);
        return { id: "asset-room", roomId: "room-1" };
      },
      getOwnedDownloadStream: async (assetId: string, ownerId: string) => {
        calls.push(["getOwnedDownloadStream", assetId, ownerId]);
        return {
          metaData: {
            id: assetId,
            name: "note.txt",
            size: "5",
            mimeType: "text/plain",
          },
          file: "stream",
        };
      },
    },
  };
}

test("create dispatches TEXT assets to AssetService.createText", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  const asset = await controller.create(
    {},
    { type: "TEXT", content: "hello" } as any,
    user as any,
  );

  assert.equal(asset.id, "asset-text");
  assert.deepEqual(calls[0], ["createText", { content: "hello" }, user]);
});

test("create dispatches LINK assets to AssetService.createLink", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  const asset = await controller.create(
    {},
    { type: "LINK", url: "https://example.com" } as any,
    user as any,
  );

  assert.equal(asset.id, "asset-link");
  assert.deepEqual(calls[0], [
    "createLink",
    { url: "https://example.com" },
    user,
  ]);
});

test("create rejects unsupported asset types", async () => {
  const { service } = createServiceMock();
  const controller = new AssetController(service as any);

  await assert.rejects(
    () => controller.create({}, { type: "FILE" } as any, user as any),
    BadRequestException,
  );
});

test("create dispatches FILE query uploads to AssetService.createFile", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  const asset = await controller.create(
    {
      type: "FILE",
      id: "asset-file",
      name: "note.txt",
      chunkIndex: "0",
      totalChunks: "1",
    },
    "aGVsbG8=" as any,
    user as any,
  );

  assert.equal(asset.id, "asset-file");
  assert.deepEqual(calls[0], [
    "createFile",
    "aGVsbG8=",
    { index: 0, total: 1 },
    { id: "asset-file", name: "note.txt" },
    user,
  ]);
});

test("read operations use the current user's id", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  await controller.list({}, user as any);
  await controller.get("asset-1", user as any);
  await controller.remove("asset-1", user as any);

  assert.deepEqual(calls, [
    ["listByOwner", "user-1", {}],
    ["getOwned", "asset-1", "user-1"],
    ["removeOwned", "asset-1", "user-1"],
  ]);
});

test("list coerces and validates query params before passing to the service", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  await controller.list(
    {
      q: "road",
      type: "TEXT",
      source: "UPLOAD",
      favorite: "true",
      tag: "docs",
      sort: "name_asc",
    },
    user as any,
  );

  assert.deepEqual(calls[0], [
    "listByOwner",
    "user-1",
    {
      q: "road",
      type: "TEXT",
      source: "UPLOAD",
      favorite: true,
      tag: "docs",
      sort: "name_asc",
    },
  ]);
});

test("list ignores invalid enum and sort values and coerces favorite=false", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  await controller.list(
    {
      type: "BOGUS",
      source: "NOPE",
      sort: "weird",
      favorite: "false",
    },
    user as any,
  );

  assert.deepEqual(calls[0], ["listByOwner", "user-1", { favorite: false }]);
});

test("listTags delegates to the current user's AssetService.listTags", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  const tags = await controller.listTags(user as any);

  assert.equal(tags.length, 1);
  assert.deepEqual(calls[0], ["listTags", "user-1"]);
});

test("download sets file headers and returns a streamable file", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);
  const headers: Record<string, string> = {};

  const result = await controller.download(
    {
      set: (value: Record<string, string>) => Object.assign(headers, value),
    } as any,
    "asset-1",
    user as any,
  );

  assert.deepEqual(calls[0], ["getOwnedDownloadStream", "asset-1", "user-1"]);
  assert.equal(headers["Content-Type"], "text/plain");
  assert.equal(headers["Content-Length"], "5");
  assert.ok(result);
});

test("asset action endpoints delegate to the current user's AssetService actions", async () => {
  const { calls, service } = createServiceMock();
  const controller = new AssetController(service as any);

  await controller.update(
    "asset-1",
    { favorite: true, tags: ["docs"], name: "Roadmap" },
    user as any,
  );
  await controller.clone("asset-1", user as any);
  await controller.share("asset-1", user as any);
  await controller.shortLink("asset-1", user as any);
  await controller.sendToRoom("asset-1", { roomId: "room-1" }, user as any);

  assert.deepEqual(calls, [
    [
      "updateOwned",
      "asset-1",
      "user-1",
      { favorite: true, tags: ["docs"], name: "Roadmap" },
    ],
    ["cloneOwned", "asset-1", user],
    ["createShareFromAsset", "asset-1", user],
    ["createShortLinkFromAsset", "asset-1", user],
    ["sendToRoom", "asset-1", "room-1", user],
  ]);
});
