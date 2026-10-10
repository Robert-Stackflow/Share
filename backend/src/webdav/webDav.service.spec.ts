import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as express from "express";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
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

test("moves a small unlocked collection without waiting for recursive DAV requests", async () => {
  const reservations = new Map<string, string>();
  const stored = new Map<string, { metadata?: Record<string, string> }>([
    [
      "dav/user-1/probe-a/.nepheleempty",
      { metadata: { "nephele-locks": "{}" } },
    ],
    ["dav/user-1/probe-a/owner.txt", { metadata: {} }],
  ]);
  const prisma = {
    webDavMoveReservation: {
      create: async ({ data }: { data: { id: string; owner: string } }) => {
        if (reservations.has(data.id)) throw { code: "P2002" };
        reservations.set(data.id, data.owner);
      },
      deleteMany: async ({
        where,
      }: {
        where: { id: string; owner: string };
      }) => {
        if (reservations.get(where.id) === where.owner)
          reservations.delete(where.id);
      },
    },
  };
  let releaseCopy: (() => void) | undefined;
  const copyBlocked = new Promise<void>((resolve) => {
    releaseCopy = resolve;
  });
  const objects = {
    webDavRootKey: (id: string) => `dav/${id}`,
    list: async (prefix: string) => ({
      objects: [...stored.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    head: async (key: string) => {
      const value = stored.get(key);
      if (!value) throw { name: "NotFound" };
      return value;
    },
    copy: async (source: string, destination: string) => {
      await copyBlocked;
      stored.set(destination, stored.get(source)!);
    },
    delete: async (key: string) => {
      stored.delete(key);
    },
  };
  const service = new WebDavService(
    { authenticateWebDav: async () => ({ user: { id: "user-1" } }) } as any,
    createConfig() as any,
    objects as any,
    prisma as any,
  );
  const request = (name: string) => ({
    method: "MOVE",
    protocol: "https",
    originalUrl: `/dav/${name}/`,
    headers: { authorization: "Basic dXNlcjpwYXNz" },
    get: (header: string) =>
      ({
        host: "share.example.com",
        destination: "https://share.example.com/dav/probe-target/",
        overwrite: "F",
      })[header.toLowerCase()],
  });
  const response = () => {
    const result = new EventEmitter() as EventEmitter & {
      locals: object;
      statusCode: number;
      status: (code: number) => typeof result;
      set: () => typeof result;
      end: () => void;
    };
    result.locals = {};
    result.statusCode = 200;
    result.status = (code) => {
      result.statusCode = code;
      return result;
    };
    result.set = () => result;
    result.end = () => result.emit("finish");
    return result;
  };
  const first = response();
  const second = response();
  const delegated: string[] = [];
  const firstMove = (service as any).handleExclusiveMove(
    request("probe-a"),
    first,
    (error: unknown) => {
      throw error;
    },
    () => delegated.push("fallback"),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await (service as any).handleExclusiveMove(
    request("probe-b"),
    second,
    (error: unknown) => {
      throw error;
    },
    () => delegated.push("fallback"),
  );
  assert.equal(second.statusCode, 423);
  releaseCopy!();
  await firstMove;
  assert.equal(first.statusCode, 201);
  assert.equal(stored.has("dav/user-1/probe-target/owner.txt"), true);
  assert.equal(stored.has("dav/user-1/probe-a/owner.txt"), false);
  assert.equal(reservations.size, 0);
  assert.deepEqual(delegated, []);
});

test("writes a small unlocked DAV file directly and respects collection locks", async () => {
  const stored = new Map<
    string,
    { key: string; metadata?: Record<string, string> }
  >([
    [
      "dav/user-1/probe/.nepheleempty",
      {
        key: "dav/user-1/probe/.nepheleempty",
        metadata: { "nephele-locks": "{}" },
      },
    ],
  ]);
  const objects = {
    webDavRootKey: (id: string) => `dav/${id}`,
    list: async (prefix: string) => ({
      objects: [...stored.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    head: async (key: string) => {
      const object = stored.get(key);
      if (!object) throw { name: "NotFound" };
      return object;
    },
    put: async (
      key: string,
      body: Buffer,
      options: { metadata?: Record<string, string> },
    ) => {
      assert.equal(body.toString(), "owner");
      stored.set(key, { key, metadata: options.metadata });
    },
  };
  const service = new WebDavService(
    { authenticateWebDav: async () => null } as any,
    createConfig() as any,
    objects as any,
    {} as any,
  );
  const request = () =>
    Object.assign(Readable.from([Buffer.from("owner")]), {
      originalUrl: "/dav/probe/owner.txt",
      protocol: "https",
      get: (header: string) =>
        ({
          host: "share.example.com",
          "content-length": "5",
          "content-type": "text/plain",
        })[header.toLowerCase()],
    });
  const response = () => ({
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    end() {
      return this;
    },
  });
  const created = response();
  assert.equal(
    await (service as any).tryFastSmallPut(request(), created, "user-1"),
    true,
  );
  assert.equal(created.statusCode, 201);
  assert.equal(stored.has("dav/user-1/probe/owner.txt"), true);

  stored.set("dav/user-1/probe/.nepheleempty", {
    key: "dav/user-1/probe/.nepheleempty",
    metadata: { "nephele-locks": '{"lock":{}}' },
  });
  const locked = response();
  assert.equal(
    await (service as any).tryFastSmallPut(request(), locked, "user-1"),
    false,
  );
  assert.equal(locked.statusCode, 200);
});
