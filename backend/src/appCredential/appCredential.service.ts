import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AppCredential, AppCredentialType, User } from "@prisma/client";
import * as argon from "argon2";
import * as crypto from "crypto";
import { PrismaService } from "src/prisma/prisma.service";
import {
  APP_CREDENTIAL_SCOPES,
  AppCredentialScope,
} from "./appCredential.types";
import { CreateAppCredentialDTO } from "./dto/createAppCredential.dto";

const TOKEN_PREFIX = "share";
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export type PublicAppCredential = Omit<
  AppCredential,
  "secretHash" | "scopes"
> & {
  scopes: AppCredentialScope[];
  active: boolean;
};

@Injectable()
export class AppCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<PublicAppCredential[]> {
    const credentials = await this.prisma.appCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return credentials.map((credential) => this.toPublic(credential));
  }

  async create(user: User, input: CreateAppCredentialDTO) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Credential name is required");

    const allowedScopes = APP_CREDENTIAL_SCOPES[input.type];
    const scopes = [
      ...new Set(input.scopes?.length ? input.scopes : allowedScopes),
    ];
    if (scopes.some((scope) => !allowedScopes.includes(scope))) {
      throw new BadRequestException(
        "One or more scopes are not valid for this credential type",
      );
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Credential expiry must be in the future");
    }

    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("base64url");
    const token = `${TOKEN_PREFIX}_${id}.${secret}`;
    const credential = await this.prisma.appCredential.create({
      data: {
        id,
        name,
        type: input.type,
        tokenHint: `${TOKEN_PREFIX}_${id.slice(0, 8)}…${secret.slice(-4)}`,
        secretHash: await argon.hash(token),
        scopes: JSON.stringify(scopes),
        expiresAt,
        user: { connect: { id: user.id } },
      },
    });

    return {
      credential: this.toPublic(credential),
      token,
      username: user.username,
    };
  }

  async revoke(id: string, userId: string): Promise<PublicAppCredential> {
    const credential = await this.prisma.appCredential.findFirst({
      where: { id, userId },
    });
    if (!credential) throw new NotFoundException("Credential not found");

    const revoked = credential.revokedAt
      ? credential
      : await this.prisma.appCredential.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
    return this.toPublic(revoked);
  }

  async authenticate(
    token: string,
    requiredScopes: AppCredentialScope[] = [],
  ): Promise<{ credential: PublicAppCredential; user: User }> {
    const id = this.parseTokenId(token);
    const credential = id
      ? await this.prisma.appCredential.findUnique({
          where: { id },
          include: { user: true },
        })
      : null;

    if (
      !credential ||
      credential.revokedAt ||
      (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) ||
      !(await argon.verify(credential.secretHash, token))
    ) {
      throw new UnauthorizedException("Invalid or expired credential");
    }

    const scopes = this.parseScopes(credential.scopes);
    if (requiredScopes.some((scope) => !scopes.includes(scope))) {
      throw new ForbiddenException("Credential scope is insufficient");
    }

    if (
      !credential.lastUsedAt ||
      Date.now() - credential.lastUsedAt.getTime() >=
        LAST_USED_WRITE_INTERVAL_MS
    ) {
      await this.prisma.appCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return {
      credential: this.toPublic(credential),
      user: credential.user,
    };
  }

  async authenticateWebDav(
    username: string,
    password: string,
    writeAccess = false,
  ) {
    const authenticated = await this.authenticate(password, [
      writeAccess
        ? AppCredentialScope.WEBDAV_WRITE
        : AppCredentialScope.WEBDAV_READ,
    ]);
    if (
      authenticated.credential.type !== AppCredentialType.APP_PASSWORD ||
      ![authenticated.user.username, authenticated.user.email].includes(
        username,
      )
    ) {
      throw new UnauthorizedException("Invalid WebDAV credentials");
    }
    return authenticated;
  }

  private parseTokenId(token: string): string | null {
    const match = /^share_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43}$/.exec(
      token ?? "",
    );
    return match?.[1] ?? null;
  }

  private parseScopes(value: string): AppCredentialScope[] {
    try {
      const scopes = JSON.parse(value);
      return Array.isArray(scopes)
        ? scopes.filter((scope) =>
            Object.values(AppCredentialScope).includes(scope),
          )
        : [];
    } catch {
      return [];
    }
  }

  private toPublic(
    credential: AppCredential & { user?: User },
  ): PublicAppCredential {
    const {
      secretHash: _secretHash,
      scopes,
      user: _user,
      ...publicCredential
    } = credential;
    return {
      ...publicCredential,
      scopes: this.parseScopes(scopes),
      active:
        !credential.revokedAt &&
        (!credential.expiresAt || credential.expiresAt.getTime() > Date.now()),
    };
  }
}
