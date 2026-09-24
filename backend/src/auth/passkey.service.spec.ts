import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AuthService } from "./auth.service";
import { PasskeyService } from "./passkey.service";

const user = {
  id: "user-1",
  email: "one@example.test",
  username: "one",
  password: null,
  ldapDN: null,
};

function createHarness() {
  const challenges: any[] = [];
  const passkeys: any[] = [];
  const session = {
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  };
  const prisma: any = {
    refreshToken: { findUnique: async () => session },
    passkeyChallenge: {
      create: async ({ data }: any) => {
        const challenge = {
          id: `challenge-${challenges.length + 1}`,
          used: false,
          ...data,
        };
        challenges.push(challenge);
        return { id: challenge.id };
      },
      updateMany: async ({ where, data }: any) => {
        const challenge = challenges.find(
          (item) =>
            item.id === where.id &&
            item.purpose === where.purpose &&
            item.userId === (where.userId ?? undefined) &&
            item.refreshTokenId === (where.refreshTokenId ?? undefined) &&
            item.used === where.used &&
            item.expiresAt > where.expiresAt.gt,
        );
        if (!challenge) return { count: 0 };
        Object.assign(challenge, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: any) =>
        challenges.find((item) => item.id === where.id),
    },
    passkeyCredential: {
      findMany: async ({ where }: any) =>
        passkeys.filter((item) => item.userId === where.userId),
      findUnique: async ({ where }: any) =>
        passkeys.find((item) => item.id === where.id),
      delete: async ({ where }: any) => {
        const index = passkeys.findIndex((item) => item.id === where.id);
        passkeys.splice(index, 1);
      },
    },
    oAuthUser: { findMany: async () => [] },
    $transaction: async (callback: any) => callback(prisma),
  };
  const jwt: any = {
    verifyAsync: async () => ({ sub: user.id, refreshTokenId: "session-1" }),
  };
  const config: any = {
    get: (name: string) =>
      ({
        "general.appUrl": "https://share.example.test",
        "general.appName": "Share",
        "oauth.disablePassword": false,
        "ldap.enabled": false,
      })[name],
  };
  const service = new PasskeyService(prisma, jwt, config, {} as any, {} as any);
  return { service, challenges, passkeys, session, config, jwt };
}

test("login options use a discoverable credential and a single-use challenge", async () => {
  const { service, challenges } = createHarness();
  const { challengeId, options } = await service.authenticationOptions();
  assert.equal(options.rpId, "share.example.test");
  assert.equal(options.userVerification, "required");
  assert.equal(options.allowCredentials, undefined);
  await assert.rejects(() =>
    service.verifyAuthentication(challengeId, {} as any),
  );
  assert.equal(challenges[0].used, true);
  await assert.rejects(
    () => service.verifyAuthentication(challengeId, {} as any),
    /验证已过期/,
  );
});

test("registration requires a recent valid session", async () => {
  const { service, session, jwt } = createHarness();
  await assert.rejects(
    () => service.registrationOptions(user as any),
    /Unauthorized/,
  );
  session.createdAt = new Date(Date.now() - 11 * 60_000);
  await assert.rejects(
    () => service.registrationOptions(user as any, "token"),
    /重新登录/,
  );
  session.createdAt = new Date();
  jwt.verifyAsync = async () => ({
    sub: "other-user",
    refreshTokenId: "session-1",
  });
  await assert.rejects(
    () => service.registrationOptions(user as any, "token"),
    /Unauthorized/,
  );
});

test("registration challenge is bound to the same account and session", async () => {
  const { service, jwt } = createHarness();
  const { challengeId } = await service.registrationOptions(
    user as any,
    "token",
  );
  jwt.verifyAsync = async () => ({
    sub: user.id,
    refreshTokenId: "another-session",
  });
  await assert.rejects(
    () =>
      service.verifyRegistration(
        user as any,
        "token",
        challengeId,
        {} as any,
        "test",
      ),
    /验证已过期/,
  );
});

test("the final login method cannot be removed", async () => {
  const { service, passkeys } = createHarness();
  passkeys.push({ id: "key-1", userId: user.id });
  await assert.rejects(
    () => service.remove(user as any, "token", "key-1"),
    /最后一种登录方式/,
  );
  assert.equal(passkeys.length, 1);
});

test("passkeys require an HTTPS origin outside local development", async () => {
  const { service, config } = createHarness();
  config.get = (name: string) =>
    name === "general.appUrl" ? "http://share.example.test" : "Share";
  await assert.rejects(() => service.authenticationOptions(), /HTTPS/);
});

test("verified passkeys satisfy TOTP while password login still requires it", async () => {
  const auth: any = Object.create(AuthService.prototype);
  auth.config = { get: () => false };
  auth.createLoginToken = async () => "totp-token";
  auth.createRefreshToken = async () => ({
    refreshToken: "refresh-token",
    refreshTokenId: "session-1",
  });
  auth.createAccessToken = async () => "access-token";
  const totpUser = { ...user, totpVerified: true };
  assert.deepEqual(await auth.generateToken(totpUser as any), {
    loginToken: "totp-token",
  });
  assert.deepEqual(await auth.generateToken(totpUser as any, undefined, true), {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
});
