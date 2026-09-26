import { ForbiddenException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FileSecurityGuard } from "./fileSecurity.guard";

test("pickup share files cannot be downloaded directly without redemption", async () => {
  const guard = new (FileSecurityGuard as any)(
    {},
    {
      share: {
        findUnique: async () => ({
          id: "pickup-share",
          pickupCode: "012345",
          expiration: new Date(0),
          security: null,
        }),
      },
    },
    { get: () => false },
    { t: (key: string) => key },
    {},
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ params: { shareId: "pickup-share" }, cookies: {} }),
    }),
  } as any;

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
});
