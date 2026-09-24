import { ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AccessPolicy } from "@prisma/client";
import * as argon from "argon2";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { AccessControlDTO } from "./dto/accessControl.dto";

type AccessPolicyRelation =
  | { shareId: string }
  | { roomId: string }
  | { shortLinkId: string }
  | { reverseShareId: string };

type AccessContext = {
  now?: Date;
  requireDownload?: boolean;
  userId?: string | null;
};

type AccessPolicyTokenClaims = {
  accessPolicyId: string;
  accessPolicyUpdatedAt: number;
};

@Injectable()
export class AccessPolicyService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  assertAllowed(
    policy?: Partial<AccessPolicy> | null,
    context: AccessContext = {},
  ) {
    if (!policy) return true;

    const now = context.now ?? new Date();
    if (policy.expiresAt && now > new Date(policy.expiresAt)) {
      throw new ForbiddenException("Access has expired");
    }

    const views = policy.views ?? 0;
    const maxViews = policy.oneTime ? 1 : policy.maxViews;
    if (maxViews !== null && maxViews !== undefined && views >= maxViews) {
      throw new ForbiddenException("Access limit exceeded");
    }

    if (policy.allowAnonymous === false && !context.userId) {
      throw new ForbiddenException("Authentication required");
    }

    if (context.requireDownload && policy.allowDownload === false) {
      throw new ForbiddenException("Download is disabled");
    }

    return true;
  }

  async verifyPassword(
    policy: Pick<AccessPolicy, "passwordHash">,
    password?: string,
  ) {
    if (!policy.passwordHash) return true;
    if (!password || !(await argon.verify(policy.passwordHash, password))) {
      throw new ForbiddenException("Invalid password");
    }
    return true;
  }

  async upsertForRelation(
    relation: AccessPolicyRelation,
    input: AccessControlDTO,
  ): Promise<AccessPolicy> {
    const existing = await this.prisma.accessPolicy.findFirst({
      where: relation,
    });

    const passwordHash = await this.resolvePasswordHash(input.password);
    const expiresAt = this.resolveExpiresAt(input.expiresAt);

    if (existing) {
      return this.prisma.accessPolicy.update({
        where: { id: existing.id },
        data: {
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(input.maxViews !== undefined ? { maxViews: input.maxViews } : {}),
          ...(input.allowDownload !== undefined
            ? { allowDownload: input.allowDownload }
            : {}),
          ...(input.allowAnonymous !== undefined
            ? { allowAnonymous: input.allowAnonymous }
            : {}),
          ...(input.oneTime !== undefined ? { oneTime: input.oneTime } : {}),
        },
      });
    }

    return this.prisma.accessPolicy.create({
      data: {
        ...relation,
        passwordHash: passwordHash ?? null,
        expiresAt: expiresAt ?? null,
        ...(input.maxViews !== undefined ? { maxViews: input.maxViews } : {}),
        ...(input.allowDownload !== undefined
          ? { allowDownload: input.allowDownload }
          : {}),
        ...(input.allowAnonymous !== undefined
          ? { allowAnonymous: input.allowAnonymous }
          : {}),
        ...(input.oneTime !== undefined ? { oneTime: input.oneTime } : {}),
      },
    });
  }

  // Returns `undefined` to leave the existing hash unchanged, `null` to clear
  // it, or a freshly hashed password string.
  private async resolvePasswordHash(password?: string) {
    if (password === undefined) return undefined;
    if (password === "") return null;
    return argon.hash(password);
  }

  // Returns `undefined` to leave the existing value unchanged, `null` to clear
  // it, or the parsed Date.
  private resolveExpiresAt(expiresAt?: string | null) {
    if (expiresAt === undefined) return undefined;
    if (expiresAt === null || expiresAt === "") return null;
    return new Date(expiresAt);
  }

  async recordView(policy: Pick<AccessPolicy, "id" | "oneTime">) {
    return this.prisma.accessPolicy.update({
      where: { id: policy.id },
      data: { views: { increment: 1 } },
    });
  }

  signPolicyToken(policy: Pick<AccessPolicy, "id" | "updatedAt">) {
    return this.jwtService.sign(
      {
        accessPolicyId: policy.id,
        accessPolicyUpdatedAt: this.toUnixSeconds(policy.updatedAt),
      },
      {
        expiresIn: "24h",
        secret: this.config.get("internal.jwtSecret"),
      },
    );
  }

  verifyPolicyToken(token: string): AccessPolicyTokenClaims {
    return this.jwtService.verify(token, {
      secret: this.config.get("internal.jwtSecret"),
    });
  }

  private toUnixSeconds(date: Date) {
    return Math.floor(new Date(date).getTime() / 1000);
  }
}
