import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PasskeyCredential, User } from "@prisma/client";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { ActivityService } from "src/activity/activity.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "./auth.service";

const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const RECENT_LOGIN_MS = 10 * 60 * 1000;
const MAX_PASSKEYS = 10;

@Injectable()
export class PasskeyService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private auth: AuthService,
    private activity: ActivityService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredChallenges() {
    await this.prisma.passkeyChallenge.deleteMany({
      where: {
        OR: [
          {
            used: true,
            createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
          },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });
  }

  private relyingParty() {
    const url = new URL(this.config.get("general.appUrl"));
    const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new BadRequestException("通行密钥需要正确配置 HTTPS 站点地址");
    }
    return { origin: url.origin, rpID: url.hostname };
  }

  private async recentSession(user: User, accessToken?: string) {
    if (!user || !accessToken) throw new UnauthorizedException();
    let payload: { sub: string; refreshTokenId: string };
    try {
      payload = await this.jwt.verifyAsync(accessToken, {
        secret: this.config.get("internal.jwtSecret"),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.sub !== user.id || !payload.refreshTokenId)
      throw new UnauthorizedException();
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.refreshTokenId },
      select: { userId: true, createdAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.userId !== user.id ||
      session.expiresAt <= new Date()
    )
      throw new UnauthorizedException();
    if (Date.now() - session.createdAt.getTime() > RECENT_LOGIN_MS)
      throw new ForbiddenException("请重新登录后管理通行密钥");
    return payload.refreshTokenId;
  }

  async list(user: User) {
    if (!user) throw new UnauthorizedException();
    return this.prisma.passkeyCredential.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async registrationOptions(user: User, accessToken?: string) {
    const refreshTokenId = await this.recentSession(user, accessToken);
    const existing = await this.prisma.passkeyCredential.findMany({
      where: { userId: user.id },
      select: { id: true, transports: true },
    });
    if (existing.length >= MAX_PASSKEYS)
      throw new BadRequestException("通行密钥数量已达上限");
    const { rpID } = this.relyingParty();
    const options = await generateRegistrationOptions({
      rpName: this.config.get("general.appName") || "Share",
      rpID,
      userID: new Uint8Array(Buffer.from(user.id, "utf8")),
      userName: user.email,
      userDisplayName: user.username,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials: existing.map((item) => ({
        id: item.id,
        transports: item.transports ? JSON.parse(item.transports) : undefined,
      })),
    });
    const challenge = await this.prisma.passkeyChallenge.create({
      data: {
        challenge: options.challenge,
        purpose: "REGISTER",
        userId: user.id,
        refreshTokenId,
        expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS),
      },
      select: { id: true },
    });
    return { challengeId: challenge.id, options };
  }

  async verifyRegistration(
    user: User,
    accessToken: string,
    challengeId: string,
    response: RegistrationResponseJSON,
    name: string,
    ip?: string,
    userAgent?: string,
  ) {
    const refreshTokenId = await this.recentSession(user, accessToken);
    const challenge = await this.consumeChallenge(
      challengeId,
      "REGISTER",
      user.id,
      refreshTokenId,
    );
    const { origin, rpID } = this.relyingParty();
    let result: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      result = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new BadRequestException("通行密钥验证失败，请重试");
    }
    if (!result.verified || !result.registrationInfo?.userVerified)
      throw new BadRequestException("通行密钥验证失败，请重试");
    const { credential, credentialDeviceType, credentialBackedUp } =
      result.registrationInfo;
    if (response.id !== credential.id || response.type !== "public-key")
      throw new BadRequestException("通行密钥凭据不匹配");
    const cleanName =
      typeof name === "string"
        ? name.trim().slice(0, 80) || "通行密钥"
        : "通行密钥";
    const saved = await this.prisma.passkeyCredential.create({
      data: {
        id: credential.id,
        userId: user.id,
        name: cleanName,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports
          ? JSON.stringify(credential.transports)
          : null,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    });
    await this.activity.record({
      actorId: user.id,
      action: "passkey.register",
      targetType: "passkey",
      targetId: saved.id,
      ip,
      userAgent,
    });
    return { id: saved.id, name: saved.name };
  }

  async authenticationOptions() {
    const { rpID } = this.relyingParty();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });
    const challenge = await this.prisma.passkeyChallenge.create({
      data: {
        challenge: options.challenge,
        purpose: "LOGIN",
        expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS),
      },
      select: { id: true },
    });
    return { challengeId: challenge.id, options };
  }

  async verifyAuthentication(
    challengeId: string,
    response: AuthenticationResponseJSON,
    ip?: string,
    userAgent?: string,
  ) {
    const challenge = await this.consumeChallenge(challengeId, "LOGIN");
    if (!response?.id || response.type !== "public-key")
      throw new UnauthorizedException("通行密钥验证失败");
    const stored = await this.prisma.passkeyCredential.findUnique({
      where: { id: response.id },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException("通行密钥验证失败");
    const { origin, rpID } = this.relyingParty();
    let result: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: this.verifierCredential(stored),
      });
    } catch {
      throw new UnauthorizedException("通行密钥验证失败");
    }
    if (
      !result.verified ||
      !result.authenticationInfo.userVerified ||
      result.authenticationInfo.credentialID !== stored.id
    )
      throw new UnauthorizedException("通行密钥验证失败");
    // A conditional update rejects concurrent reuse of a credential counter.
    const updated = await this.prisma.passkeyCredential.updateMany({
      where: { id: stored.id, counter: stored.counter },
      data: {
        counter: result.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
        backedUp: result.authenticationInfo.credentialBackedUp,
      },
    });
    if (updated.count !== 1)
      throw new UnauthorizedException("通行密钥验证失败");
    await this.activity.record({
      actorId: stored.userId,
      action: "passkey.login",
      targetType: "passkey",
      targetId: stored.id,
      ip,
      userAgent,
    });
    // User verification on the authenticator satisfies the login step for a TOTP account.
    return this.auth.generateToken(stored.user, undefined, true);
  }

  async rename(user: User, accessToken: string, id: string, name: string) {
    await this.recentSession(user, accessToken);
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName || cleanName.length > 80)
      throw new BadRequestException("名称应为 1 到 80 个字符");
    const updated = await this.prisma.passkeyCredential.updateMany({
      where: { id, userId: user.id },
      data: { name: cleanName },
    });
    if (!updated.count) throw new BadRequestException("找不到通行密钥");
    await this.activity.record({
      actorId: user.id,
      action: "passkey.rename",
      targetType: "passkey",
      targetId: id,
    });
    return { id, name: cleanName };
  }

  async remove(user: User, accessToken: string, id: string) {
    await this.recentSession(user, accessToken);
    await this.prisma.$transaction(async (tx) => {
      const passkeys = await tx.passkeyCredential.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!passkeys.some((key) => key.id === id))
        throw new BadRequestException("找不到通行密钥");
      if (passkeys.length === 1) {
        const oauthLinks = await tx.oAuthUser.findMany({
          where: { userId: user.id },
          select: { provider: true },
        });
        const oauthUsable = oauthLinks.some((link) =>
          this.config.get(`oauth.${link.provider}-enabled`),
        );
        const passwordUsable =
          !!user.password && !this.config.get("oauth.disablePassword");
        const ldapUsable = !!user.ldapDN && this.config.get("ldap.enabled");
        if (!passwordUsable && !ldapUsable && !oauthUsable)
          throw new ForbiddenException(
            "这是当前账户最后一种登录方式，请先添加其他登录方式",
          );
      }
      await tx.passkeyCredential.delete({ where: { id } });
    });
    await this.activity.record({
      actorId: user.id,
      action: "passkey.remove",
      targetType: "passkey",
      targetId: id,
    });
  }

  private verifierCredential(stored: PasskeyCredential) {
    return {
      id: stored.id,
      publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
      counter: stored.counter,
      transports: stored.transports ? JSON.parse(stored.transports) : undefined,
    };
  }

  private async consumeChallenge(
    id: string,
    purpose: string,
    userId?: string,
    refreshTokenId?: string,
  ) {
    if (!id || typeof id !== "string")
      throw new UnauthorizedException("验证已过期，请重试");
    const now = new Date();
    const result = await this.prisma.passkeyChallenge.updateMany({
      where: {
        id,
        purpose,
        userId: userId ?? null,
        refreshTokenId: refreshTokenId ?? null,
        used: false,
        expiresAt: { gt: now },
      },
      data: { used: true },
    });
    if (result.count !== 1)
      throw new UnauthorizedException("验证已过期，请重试");
    return this.prisma.passkeyChallenge.findUnique({ where: { id } });
  }
}
