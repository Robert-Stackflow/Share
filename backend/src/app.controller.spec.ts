import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AppController } from "./app.controller";

test("short link password page remains public when public shares are disabled", async () => {
  const controller = new AppController(
    {} as unknown as ConstructorParameters<typeof AppController>[0],
    {
      getIdOfCurrentUser: async () => null,
    } as unknown as ConstructorParameters<typeof AppController>[1],
    { get: () => false } as unknown as ConstructorParameters<
      typeof AppController
    >[2],
  );
  let status = 0;
  let redirect = "";
  const response = {
    status(value: number) {
      status = value;
      return this;
    },
    send() {
      return this;
    },
    redirect(_code: number, destination: string) {
      redirect = destination;
      return this;
    },
  };

  await controller.authorizeFrontendRoute(
    {
      headers: { "x-forwarded-uri": "/short-link-access/?code=lockedtest" },
    } as unknown as Parameters<AppController["authorizeFrontendRoute"]>[0],
    response as unknown as Parameters<
      AppController["authorizeFrontendRoute"]
    >[1],
  );
  assert.equal(status, 204);
  assert.equal(redirect, "");
});

test("pickup entry remains public when public share creation is disabled", async () => {
  const controller = new AppController(
    {} as any,
    { getIdOfCurrentUser: async () => null } as any,
    { get: () => false } as any,
  );
  let status = 0;
  let redirect = "";
  const response = {
    status(value: number) {
      status = value;
      return this;
    },
    send() {
      return this;
    },
    redirect(_code: number, destination: string) {
      redirect = destination;
      return this;
    },
  };

  await controller.authorizeFrontendRoute(
    { headers: { "x-forwarded-uri": "/pickup/" } } as any,
    response as any,
  );
  assert.equal(status, 204);
  assert.equal(redirect, "");
});
