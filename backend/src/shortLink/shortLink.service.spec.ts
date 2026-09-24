import { BadRequestException, NotFoundException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShortLinkService } from "./shortLink.service";

function matchesWhere(record: any, where: any) {
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

function createPrismaMock(records: { links?: any[]; visits?: any[] } = {}) {
  const links = records.links ?? [];
  const visits = records.visits ?? [];
  const calls: any[] = [];

  return {
    calls,
    links,
    visits,
    prisma: {
      shortLink: {
        findFirst: async (args: any) => {
          calls.push(["shortLink.findFirst", args]);
          return links.find((link) => matchesWhere(link, args.where)) ?? null;
        },
        findMany: async (args: any) => {
          calls.push(["shortLink.findMany", args]);
          return links
            .filter((link) => matchesWhere(link, args.where))
            .sort(
              (a, b) =>
                new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
            );
        },
        create: async (args: any) => {
          calls.push(["shortLink.create", args]);
          const link = {
            id: `short-link-${links.length + 1}`,
            createdAt: new Date("2026-06-28T00:00:00.000Z"),
            updatedAt: new Date("2026-06-28T00:00:00.000Z"),
            visits: 0,
            isActive: true,
            ownerId: args.data.owner?.connect?.id ?? null,
            ...args.data,
          };
          links.push(link);
          return link;
        },
        update: async (args: any) => {
          calls.push(["shortLink.update", args]);
          const link = links.find((item) => matchesWhere(item, args.where));
          if (!link) return null;
          if (args.data.visits?.increment) link.visits += args.data.visits.increment;
          Object.entries(args.data).forEach(([key, value]) => {
            if (key !== "visits") link[key] = value;
          });
          return link;
        },
        delete: async (args: any) => {
          calls.push(["shortLink.delete", args]);
          const index = links.findIndex((item) => matchesWhere(item, args.where));
          if (index === -1) return null;
          return links.splice(index, 1)[0];
        },
      },
      shortLinkVisit: {
        create: async (args: any) => {
          calls.push(["shortLinkVisit.create", args]);
          const visit = {
            id: `visit-${visits.length + 1}`,
            createdAt: new Date("2026-06-28T01:02:03.000Z"),
            ...args.data,
          };
          visits.push(visit);
          return visit;
        },
        findMany: async (args: any) => {
          calls.push(["shortLinkVisit.findMany", args]);
          let result = visits.filter((visit) => matchesWhere(visit, args.where));
          if (args.orderBy?.createdAt === "desc") {
            result = result.sort(
              (a, b) =>
                new Date(b.createdAt).valueOf() -
                new Date(a.createdAt).valueOf(),
            );
          }
          if (args.orderBy?.createdAt === "asc") {
            result = result.sort(
              (a, b) =>
                new Date(a.createdAt).valueOf() -
                new Date(b.createdAt).valueOf(),
            );
          }
          if (typeof args.take === "number") {
            result = result.slice(0, args.take);
          }
          return result;
        },
      },
    },
  };
}

function createCacheMock() {
  const values = new Map<string, any>();
  const calls: any[] = [];
  return {
    calls,
    cache: {
      get: async (key: string) => {
        calls.push(["get", key]);
        return values.get(key);
      },
      set: async (key: string, value: any) => {
        calls.push(["set", key, value]);
        values.set(key, value);
      },
      del: async (key: string) => {
        calls.push(["del", key]);
        values.delete(key);
      },
    },
  };
}

function createAccessPolicyMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      upsertForRelation: async (relation: any, input: any) => {
        calls.push(["upsertForRelation", relation, input]);
        return { id: "policy-1", ...relation, ...input };
      },
    },
  };
}

const user = { id: "user-1" };
const config = {
  get: (key: string) => (key === "internal.jwtSecret" ? "test-secret" : null),
};

test("create stores an owned external URL short link with a generated code", async () => {
  const { links, prisma } = createPrismaMock();
  const { calls: cacheCalls, cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  const link = await service.create(
    { targetType: "URL", targetUrl: "https://example.com/docs", title: "Docs" },
    user as any,
  );

  assert.equal(link.ownerId, "user-1");
  assert.equal(link.targetType, "URL");
  assert.equal(link.targetUrl, "https://example.com/docs");
  assert.match(link.code, /^[a-zA-Z0-9_-]{7}$/);
  assert.equal(links.length, 1);
  assert.deepEqual(
    cacheCalls.find(([name, key]) => name === "set" && key.endsWith(":target")),
    ["set", `short-link:${link.code}:target`, "https://example.com/docs"],
  );
});

test("create does not write an access policy without an accessControl payload", async () => {
  const { prisma } = createPrismaMock();
  const { cache } = createCacheMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const service = new ShortLinkService(
    prisma as any,
    cache as any,
    config as any,
    undefined,
    accessPolicyService as any,
  );

  await service.create(
    { targetType: "URL", targetUrl: "https://example.com/docs" },
    user as any,
  );

  assert.equal(policyCalls.length, 0);
});

test("create upserts an access policy for the short link when accessControl is sent", async () => {
  const { prisma } = createPrismaMock();
  const { cache } = createCacheMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const service = new ShortLinkService(
    prisma as any,
    cache as any,
    config as any,
    undefined,
    accessPolicyService as any,
  );

  const link = await service.create(
    {
      targetType: "URL",
      targetUrl: "https://example.com/docs",
      accessControl: { password: "secret123", maxViews: 5 },
    },
    user as any,
  );

  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { shortLinkId: link.id },
    { password: "secret123", maxViews: 5 },
  ]);
});

test("updateOwned upserts an access policy for the short link when accessControl is sent", async () => {
  const { prisma } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        ownerId: "user-1",
        isActive: true,
        visits: 0,
      },
    ],
  });
  const { cache } = createCacheMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const service = new ShortLinkService(
    prisma as any,
    cache as any,
    config as any,
    undefined,
    accessPolicyService as any,
  );

  await service.updateOwned(
    "abc123",
    { accessControl: { allowAnonymous: false } },
    "user-1",
  );

  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { shortLinkId: "short-link-1" },
    { allowAnonymous: false },
  ]);
});

test("create rejects duplicate custom codes and invalid URLs", async () => {
  const { prisma } = createPrismaMock({
    links: [{ id: "short-link-1", code: "docs", targetUrl: "https://old.example" }],
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  await assert.rejects(
    () =>
      service.create(
        { code: "docs", targetType: "URL", targetUrl: "https://example.com" },
        user as any,
      ),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.create(
        { targetType: "URL", targetUrl: "javascript:alert(1)" },
        user as any,
      ),
    BadRequestException,
  );
});

test("recordVisit resolves a link, increments counters, and stores detailed logs without raw IPs", async () => {
  const { calls, prisma, visits } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        isActive: true,
        visits: 0,
        createdAt: new Date("2026-06-28T00:00:00.000Z"),
      },
    ],
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  const targetUrl = await service.recordVisit("abc123", {
    ip: "203.0.113.2",
    userAgent: "Test Browser",
    referer: "https://ref.example",
  });

  assert.equal(targetUrl, "https://example.com/docs");
  assert.deepEqual(
    calls.find(([name]) => name === "shortLink.update"),
    ["shortLink.update", { where: { code: "abc123" }, data: { visits: { increment: 1 } } }],
  );
  assert.equal(visits.length, 1);
  assert.equal(visits[0].shortLinkId, "short-link-1");
  assert.equal(visits[0].ip, undefined);
  assert.equal(typeof visits[0].ipHash, "string");
  assert.equal(visits[0].userAgent, "Test Browser");
  assert.equal(visits[0].referer, "https://ref.example");
});

test("recordVisit rejects missing and inactive links", async () => {
  const { prisma } = createPrismaMock({
    links: [{ id: "short-link-1", code: "off", isActive: false }],
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  await assert.rejects(
    () => service.recordVisit("missing", { ip: "203.0.113.2" }),
    NotFoundException,
  );
  await assert.rejects(
    () => service.recordVisit("off", { ip: "203.0.113.2" }),
    NotFoundException,
  );
});

test("getStats returns total visits, aggregate buckets, unique visitors, and recent visit details for the owner", async () => {
  const { prisma } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        ownerId: "user-1",
        visits: 4,
      },
    ],
    visits: [
      {
        id: "visit-1",
        shortLinkId: "short-link-1",
        createdAt: new Date("2026-06-28T01:00:00.000Z"),
        ipHash: "hash-1",
        userAgent: "Browser A",
        referer: "https://ref-a.example",
      },
      {
        id: "visit-2",
        shortLinkId: "short-link-1",
        createdAt: new Date("2026-06-28T02:00:00.000Z"),
        ipHash: "hash-2",
        userAgent: "Browser B",
        referer: null,
      },
      {
        id: "visit-3",
        shortLinkId: "short-link-1",
        createdAt: new Date("2026-06-29T01:00:00.000Z"),
        ipHash: "hash-3",
        userAgent: null,
        referer: null,
      },
      {
        id: "visit-4",
        shortLinkId: "short-link-1",
        createdAt: new Date("2026-06-29T03:00:00.000Z"),
        ipHash: "hash-1",
        userAgent: "Browser A",
        referer: "https://ref-a.example",
      },
    ],
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  const stats = await service.getStats("abc123", "user-1");

  assert.equal(stats.totalVisits, 4);
  assert.deepEqual(stats.visitsByDay, [
    { date: "2026-06-28", visits: 2 },
    { date: "2026-06-29", visits: 2 },
  ]);
  assert.equal(stats.uniqueVisitors, 3);
  assert.deepEqual(stats.visitsByReferer, [
    { label: "Direct", visits: 2 },
    { label: "https://ref-a.example", visits: 2 },
  ]);
  assert.deepEqual(stats.visitsByUserAgent, [
    { label: "Browser A", visits: 2 },
    { label: "Browser B", visits: 1 },
    { label: "Unknown", visits: 1 },
  ]);
  assert.deepEqual(stats.lastVisitedAt, new Date("2026-06-29T03:00:00.000Z"));
  assert.equal(stats.recentVisits.length, 4);
  assert.equal(Object.prototype.hasOwnProperty.call(stats.recentVisits[0], "ip"), false);
});

test("getStats aggregates all visits while limiting recent visit details", async () => {
  const visits = Array.from({ length: 120 }, (_, index) => ({
    id: `visit-${index + 1}`,
    shortLinkId: "short-link-1",
    createdAt: new Date(`2026-06-${String((index % 3) + 1).padStart(2, "0")}T01:00:00.000Z`),
    ipHash: `hash-${index + 1}`,
    userAgent: index % 2 === 0 ? "Browser A" : "Browser B",
    referer: index % 4 === 0 ? "https://ref.example" : null,
  }));
  const { prisma } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        ownerId: "user-1",
        visits: 120,
      },
    ],
    visits,
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  const stats = await service.getStats("abc123", "user-1");

  assert.equal(stats.uniqueVisitors, 120);
  assert.deepEqual(stats.visitsByReferer, [
    { label: "Direct", visits: 90 },
    { label: "https://ref.example", visits: 30 },
  ]);
  assert.equal(stats.recentVisits.length, 100);
});

test("updateOwned updates an owned link and refreshes the target cache", async () => {
  const { prisma, links } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        title: "Old",
        ownerId: "user-1",
        isActive: true,
        visits: 0,
      },
    ],
  });
  const { calls: cacheCalls, cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  const updated = await service.updateOwned(
    "abc123",
    {
      targetType: "INTERNAL_PATH",
      targetUrl: "/rooms",
      title: "Rooms",
      isActive: false,
    },
    "user-1",
  );

  assert.equal(updated.targetType, "INTERNAL_PATH");
  assert.equal(updated.targetUrl, "/rooms");
  assert.equal(updated.title, "Rooms");
  assert.equal(updated.isActive, false);
  assert.equal(links[0].targetUrl, "/rooms");
  assert.deepEqual(
    cacheCalls.find(([name, key]) => name === "set" && key.endsWith(":target")),
    ["set", "short-link:abc123:target", "/rooms"],
  );
});

test("updateOwned rejects foreign links and invalid targets", async () => {
  const { prisma } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        targetType: "URL",
        targetUrl: "https://example.com/docs",
        ownerId: "user-2",
      },
    ],
  });
  const { cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  await assert.rejects(
    () => service.updateOwned("abc123", { title: "Nope" }, "user-1"),
    NotFoundException,
  );
  await assert.rejects(
    () =>
      service.updateOwned(
        "abc123",
        { targetType: "URL", targetUrl: "ftp://example.com" },
        "user-2",
      ),
    BadRequestException,
  );
});

test("removeOwned deletes an owned link and clears cached values", async () => {
  const { prisma, links } = createPrismaMock({
    links: [
      {
        id: "short-link-1",
        code: "abc123",
        ownerId: "user-1",
        targetUrl: "https://example.com/docs",
      },
    ],
  });
  const { calls: cacheCalls, cache } = createCacheMock();
  const service = new ShortLinkService(prisma as any, cache as any, config as any);

  await service.removeOwned("abc123", "user-1");

  assert.equal(links.length, 0);
  assert.deepEqual(cacheCalls.filter(([name]) => name === "del"), [
    ["del", "short-link:abc123:target"],
    ["del", "short-link:abc123:visits"],
  ]);
});
