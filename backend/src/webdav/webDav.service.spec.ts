import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as express from "express";
import { EventEmitter } from "node:events";
import { WebDavService } from "./webDav.service";

function createConfig(values: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    "s3.enabled": true,
    "webdav.enabled": true,
    "webdav.allowWrite": true,
  };
  return { get: (key: string) => ({ ...defaults, ...values })[key] };
}

function createObjects() {
  return {
    getS3ClientConfig: () => ({
      endpoint: "https://s3.example.com",
      region: "auto",
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      forcePathStyle: true,
    }),
    getBucketName: () => "share",
    resolveKey: (key: string) => `root/${key}`,
    webDavRootKey: (userId: string) => `dav/${userId}`,
    list: async () => ({ objects: [], prefixes: [] }),
    put: async () => undefined,
  };
}

async function request(
  service: WebDavService,
  path: string,
  init: RequestInit = {},
) {
  const app = express();
  app.use("/dav", service.middleware());
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not bind to a TCP port");
  }

  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("returns service unavailable while S3 storage is disabled", async () => {
  const credentials = { authenticateWebDav: async () => null };
  const service = new WebDavService(
    credentials as any,
    createConfig({ "s3.enabled": false }) as any,
    createObjects() as any,
    {} as any,
  );
  const response = await request(service, "/dav/");
  assert.equal(response.status, 503);
});

test("returns service unavailable while WebDAV is disabled", async () => {
  const credentials = { authenticateWebDav: async () => null };
  const service = new WebDavService(
    credentials as any,
    createConfig({ "webdav.enabled": false }) as any,
    createObjects() as any,
    {} as any,
  );
  const response = await request(service, "/dav/");
  assert.equal(response.status, 503);
  assert.match(await response.text(), /disabled by the administrator/);
});

test("blocks write methods when WebDAV is globally read-only", async () => {
  const credentials = { authenticateWebDav: async () => null };
  const service = new WebDavService(
    credentials as any,
    createConfig({ "webdav.allowWrite": false }) as any,
    createObjects() as any,
    {} as any,
  );
  const response = await request(service, "/dav/file.txt", {
    method: "PUT",
    body: "blocked",
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /write access is disabled/);
});

test("advertises WebDAV capabilities without requiring credentials", async () => {
  const credentials = { authenticateWebDav: async () => null };
  const service = new WebDavService(
    credentials as any,
    createConfig() as any,
    createObjects() as any,
    {} as any,
  );
  const response = await request(service, "/dav/", { method: "OPTIONS" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("dav") ?? "", /1/);
  assert.match(response.headers.get("allow") ?? "", /PROPFIND/);
});

test("challenges unauthenticated WebDAV requests with Basic auth", async () => {
  const credentials = { authenticateWebDav: async () => null };
  const service = new WebDavService(
    credentials as any,
    createConfig() as any,
    createObjects() as any,
    {} as any,
  );
  const response = await request(service, "/dav/missing.txt");
  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get("www-authenticate"),
    'Basic realm="Share WebDAV", charset="UTF-8"',
  );
});

test("maps read and write methods to the matching credential scope", async () => {
  const calls: unknown[][] = [];
  const authentication = {
    user: { id: "user-1", username: "chewie" },
    credential: { id: "credential-1" },
  };
  const credentials = {
    authenticateWebDav: async (...args: unknown[]) => {
      calls.push(args);
      return authentication;
    },
  };
  const service = new WebDavService(
    credentials as any,
    createConfig() as any,
    createObjects() as any,
    {} as any,
  );
  const encoded = Buffer.from("chewie:share_secret").toString("base64");

  await (service as any).tryAuthenticate(
    { method: "PROPFIND", headers: { authorization: `Basic ${encoded}` } },
    {},
  );
  await (service as any).tryAuthenticate(
    { method: "PUT", headers: { authorization: `Basic ${encoded}` } },
    {},
  );

  assert.deepEqual(calls, [
    ["chewie", "share_secret", false],
    ["chewie", "share_secret", true],
  ]);
});

test("initializes an empty S3 prefix once for each WebDAV user", async () => {
  const puts: string[] = [];
  const objects = {
    ...createObjects(),
    put: async (key: string) => puts.push(key),
  };
  const service = new WebDavService(
    { authenticateWebDav: async () => null } as any,
    createConfig() as any,
    objects as any,
    {} as any,
  );

  await Promise.all([
    (service as any).ensureUserRoot("user-1"),
    (service as any).ensureUserRoot("user-1"),
  ]);

  assert.deepEqual(puts, ["dav/user-1/.nepheleempty"]);
});

test("serializes non-overwriting MOVEs to the same destination across service instances", async () => {
  const rows = new Map<string, string>();
  const prisma = {
    webDavMoveReservation: {
      create: async ({ data }: { data: { id: string; owner: string } }) => {
        if (rows.has(data.id)) throw { code: "P2002" };
        rows.set(data.id, data.owner);
      },
      deleteMany: async ({
        where,
      }: {
        where: { id: string; owner: string };
      }) => {
        if (rows.get(where.id) === where.owner) rows.delete(where.id);
      },
    },
  };
  const credentials = {
    authenticateWebDav: async () => ({ user: { id: "user-1" } }),
  };
  const services = [0, 1].map(
    () =>
      new WebDavService(
        credentials as any,
        createConfig() as any,
        createObjects() as any,
        prisma as any,
      ),
  );
  const request = () => ({
    method: "MOVE",
    protocol: "https",
    headers: { authorization: "Basic dXNlcjpwYXNz" },
    get: (name: string) =>
      ({
        host: "share.example.com",
        destination: "https://share.example.com/dav/lumno/v1/write-lock/",
      })[name.toLowerCase()],
  });
  const response = () => {
    const result = new EventEmitter() as EventEmitter & {
      locals: object;
      statusCode: number;
      status: (code: number) => typeof result;
      end: () => void;
    };
    result.locals = {};
    result.statusCode = 200;
    result.status = (code) => {
      result.statusCode = code;
      return result;
    };
    result.end = () => result.emit("finish");
    return result;
  };
  const first = response();
  const second = response();
  const started: string[] = [];
  const forward = (_request: unknown, _response: unknown) => {
    started.push("MOVE");
  };
  const next = (error: unknown) => {
    throw error;
  };

  await (services[0] as any).handleExclusiveMove(
    request(),
    first,
    next,
    forward,
  );
  const waiting = (services[1] as any).handleExclusiveMove(
    request(),
    second,
    next,
    forward,
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(started, ["MOVE"]);
  assert.equal(rows.size, 1);

  first.end();
  await waiting;
  assert.deepEqual(started, ["MOVE", "MOVE"]);
  assert.equal(second.statusCode, 200);
  second.end();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(rows.size, 0);

  // An unfinished S3 move must remain reserved instead of letting another
  // request overwrite an uncertain destination.
  const interrupted = response();
  const blocked = response();
  await (services[0] as any).handleExclusiveMove(
    request(),
    interrupted,
    next,
    forward,
  );
  await (services[1] as any).handleExclusiveMove(
    request(),
    blocked,
    next,
    forward,
  );
  assert.equal(blocked.statusCode, 423);
  assert.equal(started.length, 3);
  assert.equal(rows.size, 1);
});
