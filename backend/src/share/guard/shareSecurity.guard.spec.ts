import { ForbiddenException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ShareSecurityGuard } from "./shareSecurity.guard";

function createContext(request: any, response: any = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

function createGuard({
  share,
  verifyShareToken = async () => false,
  getShareToken = async () => "issued-token",
  assertAllowed,
}: {
  share: any;
  verifyShareToken?: () => Promise<boolean>;
  getShareToken?: () => Promise<string>;
  assertAllowed?: (policy: any, context: any) => void;
}) {
  const calls: any[] = [];
  const shareService = {
    verifyShareToken: async (...args: any[]) => {
      calls.push(["verifyShareToken", ...args]);
      return verifyShareToken();
    },
    getShareToken: async (...args: any[]) => {
      calls.push(["getShareToken", ...args]);
      return getShareToken();
    },
  };
  const prisma = {
    share: {
      findUnique: async (args: any) => {
        calls.push(["share.findUnique", args]);
        return share;
      },
    },
  };
  const config = {
    get: (key: string) => {
      calls.push(["config.get", key]);
      return false;
    },
  };
  const i18n = { t: (key: string) => key };
  const accessPolicyService = {
    assertAllowed: (policy: any, context: any) => {
      calls.push(["accessPolicy.assertAllowed", policy, context]);
      if (assertAllowed) assertAllowed(policy, context);
      return true;
    },
  };

  return {
    calls,
    guard: new (ShareSecurityGuard as any)(
      shareService as any,
      prisma as any,
      config as any,
      i18n as any,
      accessPolicyService as any,
    ),
  };
}

test("public shares without an existing token issue one during the first read", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: null,
    reverseShare: null,
  };
  const cookies: any[] = [];
  const { calls, guard } = createGuard({ share });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };
  const response = {
    cookie: (...args: any[]) => cookies.push(args),
  };

  assert.equal(await guard.canActivate(createContext(request, response)), true);
  assert.deepEqual(cookies, [
    [`share_${share.id}_token`, "issued-token", { path: "/", httpOnly: true }],
  ]);
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "getShareToken" &&
        call[1] === share.id &&
        call[2] === undefined,
    ),
  );
});

test("password-protected shares still require the password flow before issuing a token", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: { password: "hash" },
    reverseShare: null,
  };
  const { calls, guard } = createGuard({ share });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };

  await assert.rejects(
    () =>
      guard.canActivate(createContext(request, { cookie: () => undefined })),
    ForbiddenException,
  );
  assert.equal(
    calls.some((call) => call[0] === "getShareToken"),
    false,
  );
});

test("view-limited shares keep the explicit token flow so max-view errors stay user-facing", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: { password: null, maxViews: 1 },
    reverseShare: null,
  };
  const { calls, guard } = createGuard({ share });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };

  await assert.rejects(
    () =>
      guard.canActivate(createContext(request, { cookie: () => undefined })),
    ForbiddenException,
  );
  assert.equal(
    calls.some((call) => call[0] === "getShareToken"),
    false,
  );
});

test("access policy passwords keep the explicit password flow without legacy share security", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: null,
    accessPolicy: { passwordHash: "policy-hash" },
    reverseShare: null,
  };
  const { calls, guard } = createGuard({ share });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };

  await assert.rejects(
    () =>
      guard.canActivate(createContext(request, { cookie: () => undefined })),
    ForbiddenException,
  );
  assert.equal(
    calls.some((call) => call[0] === "getShareToken"),
    false,
  );
});

test("access policy view limits keep the explicit token flow", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: null,
    accessPolicy: { maxViews: 1, views: 0 },
    reverseShare: null,
  };
  const { calls, guard } = createGuard({ share });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };

  await assert.rejects(
    () =>
      guard.canActivate(createContext(request, { cookie: () => undefined })),
    ForbiddenException,
  );
  assert.equal(
    calls.some((call) => call[0] === "getShareToken"),
    false,
  );
});

test("access policy can disallow anonymous share reads", async () => {
  const share = {
    id: "share-1",
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    expiration: new Date(0),
    security: null,
    accessPolicy: { allowAnonymous: false },
    reverseShare: null,
  };
  const { calls, guard } = createGuard({
    share,
    assertAllowed: () => {
      throw new ForbiddenException("Authentication required");
    },
  });
  const request = {
    params: { id: share.id },
    cookies: {},
    user: undefined,
  };

  await assert.rejects(
    () =>
      guard.canActivate(createContext(request, { cookie: () => undefined })),
    ForbiddenException,
  );
  assert.ok(calls.some((call) => call[0] === "accessPolicy.assertAllowed"));
});

test("pickup shares require a redeemed token before their content is read", async () => {
  const share = {
    id: "pickup-share",
    pickupCode: "012345",
    createdAt: new Date("2026-09-26T00:00:00.000Z"),
    expiration: new Date(0),
    security: null,
    reverseShare: null,
  };
  const { calls, guard } = createGuard({
    share,
    verifyShareToken: async () => true,
  });
  const response = { cookie: () => undefined };

  await assert.rejects(
    () =>
      guard.canActivate(
        createContext({ params: { id: share.id }, cookies: {} }, response),
      ),
    ForbiddenException,
  );
  assert.equal(
    calls.some(([name]) => name === "getShareToken"),
    false,
  );
  assert.equal(
    await guard.canActivate(
      createContext(
        {
          params: { id: share.id },
          cookies: { [`share_${share.id}_token`]: "redeemed-token" },
        },
        response,
      ),
    ),
    true,
  );
});
