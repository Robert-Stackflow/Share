import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShareController } from "./share.controller";

test("addAsset delegates share text and link assets to ShareService", async () => {
  const calls: any[] = [];
  const service = {
    addAsset: async (shareId: string, body: any, user: any) => {
      calls.push(["addAsset", shareId, body, user]);
      return { id: "asset-1", shareId, ...body };
    },
  };
  const controller = new ShareController(service as any, {} as any);
  const user = { id: "user-1" };

  const asset = await (controller as any).addAsset(
    "share-1",
    { type: "TEXT", content: "Notes" },
    user,
  );

  assert.equal(asset.shareId, "share-1");
  assert.deepEqual(calls, [
    ["addAsset", "share-1", { type: "TEXT", content: "Notes" }, user],
  ]);
});

test("removeAsset delegates share asset deletion to ShareService", async () => {
  const calls: any[] = [];
  const service = {
    removeAsset: async (shareId: string, assetId: string) => {
      calls.push(["removeAsset", shareId, assetId]);
    },
  };
  const controller = new ShareController(service as any, {} as any);

  await (controller as any).removeAsset("share-1", "asset-text-1");

  assert.deepEqual(calls, [["removeAsset", "share-1", "asset-text-1"]]);
});

test("pickup exchange sets the same secure share cookie used by normal share reads", async () => {
  const cookies: any[] = [];
  const controller = new ShareController(
    {
      redeemPickupCode: async () => ({
        id: "pickup-share",
        token: "share-token",
      }),
    } as any,
    { decode: () => ({ exp: 9999999999 }) } as any,
  );
  const result = await controller.redeemPickupCode(
    { code: "012345" },
    { cookies: {} } as any,
    { cookie: (...args: any[]) => cookies.push(args) } as any,
  );
  assert.deepEqual(result, { id: "pickup-share" });
  assert.deepEqual(cookies, [
    ["share_pickup-share_token", "share-token", { path: "/", httpOnly: true }],
  ]);
});
