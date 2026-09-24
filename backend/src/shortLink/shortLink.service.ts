import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { AccessPolicy, ShortLinkTargetType, User } from "@prisma/client";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";
import { AccessPolicyService } from "src/accessPolicy/accessPolicy.service";
import { ActivityService } from "src/activity/activity.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";

type CreateShortLinkInput = {
  code?: string;
  targetType: "URL" | "INTERNAL_PATH";
  targetUrl: string;
  title?: string;
  accessControl?: AccessControlDTO;
};

type UpdateShortLinkInput = {
  targetType?: "URL" | "INTERNAL_PATH";
  targetUrl?: string;
  title?: string;
  isActive?: boolean;
  accessControl?: AccessControlDTO;
};

type VisitInput = {
  ip?: string;
  userAgent?: string;
  referer?: string;
};

type ShortLinkVisitForStats = {
  createdAt: Date;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
};

const createCode = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
  7,
);

@Injectable()
export class ShortLinkService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private config: ConfigService,
    private activityService?: ActivityService,
    private accessPolicyService?: AccessPolicyService,
  ) {}

  private recordActivity(input: {
    actorId?: string | null;
    action: string;
    targetId: string;
    metadata?: Record<string, unknown> | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    void this.activityService
      ?.record({ targetType: "shortLink", ...input })
      .catch(() => undefined);
  }

  async create(data: CreateShortLinkInput, owner: User) {
    const code = data.code?.trim() || (await this.createAvailableCode());
    this.validateCode(code);

    if (await this.prisma.shortLink.findFirst({ where: { code } })) {
      throw new BadRequestException("Short link code is already in use");
    }

    const targetUrl = this.normalizeTarget(data.targetType, data.targetUrl);

    const link = await this.prisma.shortLink.create({
      data: {
        code,
        title: data.title?.trim() || null,
        targetType: data.targetType as ShortLinkTargetType,
        targetUrl,
        owner: { connect: { id: owner.id } },
      },
    });

    if (data.accessControl) {
      try {
        if (!this.accessPolicyService) throw new InternalServerErrorException("Access policy service unavailable");
        await this.accessPolicyService.upsertForRelation(
          { shortLinkId: link.id },
          data.accessControl,
        );
      } catch (error) {
        await this.prisma.shortLink.delete({ where: { id: link.id } });
        throw error;
      }
    }

    await this.cache.set(this.targetCacheKey(code), targetUrl);
    await this.cache.set(this.visitCacheKey(code), link.visits);

    this.recordActivity({
      actorId: owner.id,
      action: "shortLink.create",
      targetId: link.id,
      metadata: { code: link.code, targetType: link.targetType },
    });

    return link;
  }

  async listByOwner(ownerId: string) {
    const links = await this.prisma.shortLink.findMany({
      where: { ownerId },
      include: { accessPolicy: true },
      orderBy: { createdAt: "desc" },
    });
    return links.map(({ accessPolicy, ...link }) => ({
      ...link,
      accessControl: this.publicPolicy(accessPolicy),
    }));
  }

  async getAccessStatus(code: string) {
    const link = await this.prisma.shortLink.findFirst({
      where: { code },
      include: { accessPolicy: true },
    });
    if (!link) throw new NotFoundException("Short link not found");
    const policy = link.accessPolicy;
    const limit = policy?.oneTime ? 1 : policy?.maxViews;
    return {
      title: link.title,
      status: !link.isActive ? "disabled"
        : policy?.expiresAt && new Date() > policy.expiresAt ? "expired"
        : limit != null && policy.views >= limit ? "limit" : "active",
      requiresPassword: Boolean(policy?.passwordHash),
      requiresSignIn: policy?.allowAnonymous === false,
    };
  }

  async recordVisit(
    code: string,
    visit: VisitInput,
    access: { password?: string; userId?: string | null } = {},
  ) {
    const link = await this.prisma.shortLink.findFirst({
      where: { code },
      include: { accessPolicy: true },
    });
    if (!link?.isActive) throw new NotFoundException("Short link not found");

    if (link.accessPolicy) {
      if (!this.accessPolicyService) throw new InternalServerErrorException("Access policy service unavailable");
      this.accessPolicyService.assertAllowed(link.accessPolicy, { userId: access.userId });
      await this.accessPolicyService.verifyPassword(link.accessPolicy, access.password);
      const limit = link.accessPolicy.oneTime ? 1 : link.accessPolicy.maxViews;
      if (limit != null) {
        const result = await this.prisma.accessPolicy.updateMany({
          where: { id: link.accessPolicy.id, views: { lt: limit } },
          data: { views: { increment: 1 } },
        });
        if (result.count !== 1) throw new ForbiddenException("Access limit exceeded");
      } else {
        await this.accessPolicyService.recordView(link.accessPolicy);
      }
    }

    const cachedTarget = await this.cache.get<string>(this.targetCacheKey(code));
    const targetUrl = cachedTarget || link.targetUrl;
    if (!cachedTarget) {
      await this.cache.set(this.targetCacheKey(code), targetUrl);
    }

    await this.prisma.shortLink.update({
      where: { code },
      data: { visits: { increment: 1 } },
    });
    await this.cache.set(this.visitCacheKey(code), link.visits + 1);

    await this.prisma.shortLinkVisit.create({
      data: {
        shortLinkId: link.id,
        ipHash: this.hashIp(visit.ip),
        userAgent: this.truncate(visit.userAgent, 500),
        referer: this.truncate(visit.referer, 500),
      },
    });

    this.recordActivity({
      actorId: link.ownerId ?? null,
      action: "shortLink.visit",
      targetId: link.id,
      metadata: { code: link.code },
      ip: visit.ip ?? null,
      userAgent: visit.userAgent ?? null,
    });

    return targetUrl;
  }

  private publicPolicy(policy?: AccessPolicy | null) {
    if (!policy) return null;
    return {
      passwordProtected: Boolean(policy.passwordHash),
      expiresAt: policy.expiresAt,
      maxViews: policy.maxViews,
      views: policy.views,
      allowAnonymous: policy.allowAnonymous,
      oneTime: policy.oneTime,
    };
  }

  async getStats(code: string, ownerId: string) {
    const link = await this.prisma.shortLink.findFirst({
      where: { code, ownerId },
    });
    if (!link) throw new NotFoundException("Short link not found");

    const [visitsForStats, recentVisits] = await Promise.all([
      this.prisma.shortLinkVisit.findMany({
        where: { shortLinkId: link.id },
      }),
      this.prisma.shortLinkVisit.findMany({
        where: { shortLinkId: link.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const cachedVisits = Number(await this.cache.get(this.visitCacheKey(code)));
    const totalVisits = Number.isFinite(cachedVisits)
      ? Math.max(link.visits, cachedVisits)
      : link.visits;

    return {
      code: link.code,
      targetType: link.targetType,
      targetUrl: link.targetUrl,
      totalVisits,
      uniqueVisitors: this.getUniqueVisitorCount(visitsForStats),
      lastVisitedAt: this.getLastVisitedAt(visitsForStats),
      visitsByDay: this.getVisitsByDay(visitsForStats),
      visitsByReferer: this.getVisitsByDimension(
        visitsForStats,
        (visit) => visit.referer,
        "Direct",
      ),
      visitsByUserAgent: this.getVisitsByDimension(
        visitsForStats,
        (visit) => visit.userAgent,
        "Unknown",
      ),
      recentVisits: recentVisits.map((visit) => ({
        id: visit.id,
        createdAt: visit.createdAt,
        ipHash: visit.ipHash,
        userAgent: visit.userAgent,
        referer: visit.referer,
      })),
    };
  }

  async updateOwned(
    code: string,
    data: UpdateShortLinkInput,
    ownerId: string,
  ) {
    const link = await this.getOwned(code, ownerId);
    const targetType = data.targetType ?? link.targetType;
    const targetUrl =
      data.targetUrl !== undefined
        ? this.normalizeTarget(targetType as "URL" | "INTERNAL_PATH", data.targetUrl)
        : link.targetUrl;

    const updated = await this.prisma.shortLink.update({
      where: { code, ownerId },
      data: {
        targetType: targetType as ShortLinkTargetType,
        targetUrl,
        title: data.title === undefined ? link.title : data.title.trim() || null,
        isActive: data.isActive === undefined ? link.isActive : data.isActive,
      },
    });

    if (data.accessControl) {
      await this.accessPolicyService?.upsertForRelation(
        { shortLinkId: updated.id },
        data.accessControl,
      );
    }

    await this.cache.set(this.targetCacheKey(code), targetUrl);
    return updated;
  }

  async removeOwned(code: string, ownerId: string) {
    const link = await this.getOwned(code, ownerId);
    await this.prisma.shortLink.delete({ where: { code, ownerId } });
    await this.cache.del(this.targetCacheKey(code));
    await this.cache.del(this.visitCacheKey(code));

    this.recordActivity({
      actorId: ownerId,
      action: "shortLink.delete",
      targetId: link.id,
      metadata: { code: link.code },
    });
  }

  private async getOwned(code: string, ownerId: string) {
    const link = await this.prisma.shortLink.findFirst({
      where: { code, ownerId },
    });
    if (!link) throw new NotFoundException("Short link not found");
    return link;
  }

  private async createAvailableCode() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createCode();
      const existing = await this.prisma.shortLink.findFirst({
        where: { code },
      });
      if (!existing) return code;
    }
    throw new BadRequestException("Could not generate a short link code");
  }

  private validateCode(code: string) {
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(code)) {
      throw new BadRequestException("Short link code is invalid");
    }
  }

  private normalizeTarget(type: "URL" | "INTERNAL_PATH", targetUrl: string) {
    if (type === "URL") {
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // Throw the shared validation error below.
      }
      throw new BadRequestException("Short link URL is invalid");
    }

    if (
      type === "INTERNAL_PATH" &&
      targetUrl.startsWith("/") &&
      !targetUrl.startsWith("//")
    ) {
      return targetUrl;
    }

    throw new BadRequestException("Short link internal path is invalid");
  }

  private getVisitsByDay(visits: { createdAt: Date }[]) {
    const buckets = new Map<string, number>();
    visits.forEach((visit) => {
      const date = new Date(visit.createdAt).toISOString().slice(0, 10);
      buckets.set(date, (buckets.get(date) ?? 0) + 1);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, visitCount]) => ({ date, visits: visitCount }));
  }

  private getVisitsByDimension(
    visits: ShortLinkVisitForStats[],
    getValue: (visit: ShortLinkVisitForStats) => string | null,
    fallbackLabel: string,
  ) {
    const buckets = new Map<string, number>();
    visits.forEach((visit) => {
      const label = getValue(visit)?.trim() || fallbackLabel;
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    });

    return Array.from(buckets.entries())
      .sort(([labelA, visitsA], [labelB, visitsB]) => {
        if (visitsA !== visitsB) return visitsB - visitsA;
        return labelA.localeCompare(labelB);
      })
      .slice(0, 10)
      .map(([label, visitCount]) => ({ label, visits: visitCount }));
  }

  private getUniqueVisitorCount(visits: ShortLinkVisitForStats[]) {
    return new Set(visits.map((visit) => visit.ipHash).filter(Boolean)).size;
  }

  private getLastVisitedAt(visits: ShortLinkVisitForStats[]) {
    if (visits.length === 0) return null;
    return visits.reduce<Date | null>((latest, visit) => {
      if (!latest || visit.createdAt > latest) return visit.createdAt;
      return latest;
    }, null);
  }

  private hashIp(ip?: string) {
    if (!ip) return null;
    return crypto
      .createHmac("sha256", this.config.get("internal.jwtSecret"))
      .update(ip)
      .digest("hex");
  }

  private truncate(value?: string, maxLength = 500) {
    if (!value) return null;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private targetCacheKey(code: string) {
    return `short-link:${code}:target`;
  }

  private visitCacheKey(code: string) {
    return `short-link:${code}:visits`;
  }
}
