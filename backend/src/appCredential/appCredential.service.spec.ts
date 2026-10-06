import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AppCredentialType } from "@prisma/client";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AppCredentialService } from "./appCredential.service";
import { AppCredentialScope } from "./appCredential.types";

const user = {
  id: "user-1",
  username: "chewie",
  email: "chewie@example.com",
  password: null,
  isAdmin: false,
  ldapDN: null,
  totpEnabled: false,
  totpVerified: false,
  totpSecret: null,
  language: "en-US",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createPrisma() {
  const credentials = new Map<string, any>();

  return {
    credentials,
    prisma: {
      appCredential: {
        create: async ({ data }: { data: any }) => {
          const record = {
            ...data,
            userId: data.user.connect.id,
            user: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUsedAt: null,
            revokedAt: null,
          };
          credentials.set(record.id, record);
          return record;
        },
        findMany: async ({ where }: { where: { userId: string } }) =>
          [...credentials.values()].filter(
            (credential) => credential.userId === where.userId,
          ),
        findFirst: async ({
          where,
        }: {
          where: { id: string; userId: string };
        }) => {
          const credential = credentials.get(where.id);
          return credential?.userId === where.userId ? credential : null;
        },
        findUnique: async ({ where }: { where: { id: string } }) => {
          const credential = credentials.get(where.id);
          return credential ? { ...credential, user } : null;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: any;
        }) => {
          const record = {
            ...credentials.get(where.id),
            ...data,
            updatedAt: new Date(),
          };
          credentials.set(where.id, record);
          return record;
        },
      },
    },
  };
}

test("creates an API token, stores only its hash, and returns it once", async () => {
  const { prisma, credentials } = createPrisma();
  const service = new AppCredentialService(prisma as any);

  const created = await service.create(user as any, {
    name: "Uploader",
    type: AppCredentialType.API_TOKEN,
  });

  assert.match(created.token, /^share_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(created.username, "chewie");
  assert.deepEqual(created.credential.scopes, [
    AppCredentialScope.IMAGE_READ,
    AppCredentialScope.IMAGE_WRITE,
  ]);
  assert.equal("secretHash" in created.credential, false);
  assert.notEqual(
    credentials.get(created.credential.id).secretHash,
    created.token,
  );
});

test("authenticates scoped API tokens and never exposes the related user", async () => {
  const { prisma, credentials } = createPrisma();
  const service = new AppCredentialService(prisma as any);
  const created = await service.create(user as any, {
    name: "Read-only image token",
    type: AppCredentialType.API_TOKEN,
    scopes: [AppCredentialScope.IMAGE_READ],
  });

  const authenticated = await service.authenticate(created.token, [
    AppCredentialScope.IMAGE_READ,
  ]);
  assert.equal(authenticated.user.id, user.id);
  assert.equal("user" in authenticated.credential, false);
  assert.ok(credentials.get(created.credential.id).lastUsedAt instanceof Date);

  await assert.rejects(
    () => service.authenticate(created.token, [AppCredentialScope.IMAGE_WRITE]),
    ForbiddenException,
  );
});

test("uses app passwords for WebDAV usernames and rejects revoked secrets", async () => {
  const { prisma } = createPrisma();
  const service = new AppCredentialService(prisma as any);
  const created = await service.create(user as any, {
    name: "Laptop WebDAV",
    type: AppCredentialType.APP_PASSWORD,
  });

  const authenticated = await service.authenticateWebDav(
    user.email,
    created.token,
    true,
  );
  assert.equal(authenticated.user.id, user.id);

  await assert.rejects(
    () => service.authenticateWebDav("someone-else", created.token),
    UnauthorizedException,
  );

  await service.revoke(created.credential.id, user.id);
  await assert.rejects(
    () => service.authenticate(created.token),
    UnauthorizedException,
  );
});
