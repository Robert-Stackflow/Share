import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Asset,
  AssetSource,
  AssetType,
  Room,
  Share,
  StorageProvider,
  User,
} from "@prisma/client";
import * as crypto from "crypto";
import * as mime from "mime-types";
import * as moment from "moment";
import { customAlphabet } from "nanoid";
import { Readable } from "stream";
import { validate as isValidUUID } from "uuid";
import { ActivityService } from "src/activity/activity.service";
import { ConfigService } from "src/config/config.service";
import { ShortLinkService } from "src/shortLink/shortLink.service";
import { StorageService } from "src/storage/storage.service";
import { PrismaService } from "../prisma/prisma.service";
import { roomChanges } from "../room/room.events";
import { AssetStorageService } from "./storage/asset.storage";
import { AssetLocalStorageService } from "./storage/assetLocal.storage";
import { AssetS3StorageService } from "./storage/assetS3.storage";

const createShareId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
  8,
);

type AssetContainer =
  | Share
  | Room
  | {
      id: string;
      type?: string;
      kind?: "SHARE" | "ROOM" | "INBOX_SUBMISSION";
    };

type UpdateAssetInput = {
  content?: string;
  url?: string;
  name?: string;
  favorite?: boolean;
  tags?: string[];
};

type AssetSortOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "lastAccessedAt_desc"
  | "name_asc";

type ListAssetFilters = {
  q?: string;
  type?: AssetType;
  source?: AssetSource;
  favorite?: boolean;
  tag?: string;
  sort?: AssetSortOption;
};

const ASSET_SORT_ORDER_BY: Record<
  AssetSortOption,
  Record<string, "asc" | "desc">
> = {
  createdAt_desc: { createdAt: "desc" },
  createdAt_asc: { createdAt: "asc" },
  lastAccessedAt_desc: { lastAccessedAt: "desc" },
  name_asc: { name: "asc" },
};

@Injectable()
export class AssetService {
  constructor(
    private prisma: PrismaService,
    private localStorage: AssetLocalStorageService,
    private s3Storage?: AssetS3StorageService,
    private config?: ConfigService,
    private shortLinkService?: ShortLinkService,
    private activityService?: ActivityService,
    private storageService?: StorageService,
  ) {}

  private recordActivity(input: {
    actorId?: string | null;
    action: string;
    targetId: string;
    metadata?: Record<string, unknown> | null;
  }) {
    void this.activityService
      ?.record({ targetType: "asset", ...input })
      .catch(() => undefined);
  }

  async createText(
    data: { content: string },
    owner?: User,
    container?: AssetContainer,
    roomBatchId?: string,
  ) {
    if (!data.content?.trim()) {
      throw new BadRequestException("Text asset content is required");
    }

    const asset = await this.prisma.asset.create({
      data: {
        type: AssetType.TEXT,
        content: data.content,
        ...(roomBatchId ? { roomBatchId } : {}),
        ...this.getSourceData(container),
        ...this.getRelationData(owner, container),
      },
    });

    if (owner && !container) {
      this.recordActivity({
        actorId: owner.id,
        action: "asset.create",
        targetId: asset.id,
        metadata: { type: AssetType.TEXT },
      });
    }

    return asset;
  }

  async createLink(
    data: { url: string },
    owner?: User,
    container?: AssetContainer,
    roomBatchId?: string,
  ) {
    if (!this.isValidUrl(data.url)) {
      throw new BadRequestException("Link asset URL is invalid");
    }

    const asset = await this.prisma.asset.create({
      data: {
        type: AssetType.LINK,
        url: data.url,
        ...(roomBatchId ? { roomBatchId } : {}),
        ...this.getSourceData(container),
        ...this.getRelationData(owner, container),
      },
    });

    if (owner && !container) {
      this.recordActivity({
        actorId: owner.id,
        action: "asset.create",
        targetId: asset.id,
        metadata: { type: AssetType.LINK },
      });
    }

    return asset;
  }

  async createFile(
    data: string | Buffer,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    owner?: User,
    container?: AssetContainer,
    trackIncomplete = false,
    roomBatchId?: string,
  ) {
    const assetId = this.getFileId(file.id);
    const storageProvider = this.getConfiguredStorageProvider();
    const storage = this.getStorage(storageProvider);

    let provisional: Asset | undefined;
    let createdProvisional = false;
    if (trackIncomplete && chunk.index === 0) {
      const existing = file.id
        ? await this.prisma.asset.findUnique({ where: { id: assetId } })
        : null;
      if (existing) {
        if (
          existing.inboxSubmissionId !== container?.id ||
          existing.type !== AssetType.FILE ||
          existing.size !== null
        ) {
          throw new BadRequestException("File asset id is already in use");
        }
        provisional = existing;
      } else {
        provisional = await this.prisma.asset.create({
          data: {
            id: assetId,
            type: AssetType.FILE,
            name: file.name,
            size: null,
            mimeType: mime.lookup(file.name) || "application/octet-stream",
            storage: storageProvider,
            ...(roomBatchId ? { roomBatchId } : {}),
            ...this.getSourceData(container),
            ...this.getRelationData(owner, container),
          },
        });
        createdProvisional = true;
      }
    }

    try {
      await storage.saveChunk(assetId, data, chunk);
    } catch (error) {
      if (createdProvisional) {
        await storage.remove(assetId);
        await this.prisma.asset.delete({ where: { id: assetId } });
      }
      throw error;
    }

    if (chunk.index !== chunk.total - 1) {
      return provisional ?? { id: assetId, name: file.name };
    }

    const fileSize = await storage.getSize(assetId);

    const asset = trackIncomplete
      ? await this.prisma.asset.update({
          where: { id: assetId },
          data: { size: fileSize.toString() },
        })
      : await this.prisma.asset.create({
          data: {
            id: assetId,
            type: AssetType.FILE,
            name: file.name,
            size: fileSize.toString(),
            mimeType: mime.lookup(file.name) || "application/octet-stream",
            storage: storageProvider,
            ...(roomBatchId ? { roomBatchId } : {}),
            ...this.getSourceData(container),
            ...this.getRelationData(owner, container),
          },
        });

    if (owner && !container) {
      this.recordActivity({
        actorId: owner.id,
        action: "asset.create",
        targetId: asset.id,
        metadata: { type: AssetType.FILE, name: asset.name },
      });
    }

    return asset;
  }

  async listByOwner(ownerId: string, filters: ListAssetFilters = {}) {
    // Standalone-asset scope is always enforced regardless of filters.
    const where: Record<string, unknown> = {
      ownerId,
      shareId: null,
      roomId: null,
      inboxSubmissionId: null,
    };

    if (filters.q) {
      // SQLite LIKE is case-insensitive for ASCII by default, and Prisma's
      // `mode: "insensitive"` is unsupported on SQLite, so a plain `contains`
      // emulates the case-insensitive substring match we want here.
      where.OR = [
        { name: { contains: filters.q } },
        { content: { contains: filters.q } },
        { url: { contains: filters.q } },
      ];
    }

    if (filters.type) where.type = filters.type;
    if (filters.source) where.source = filters.source;
    if (filters.favorite !== undefined) where.favorite = filters.favorite;
    if (filters.tag) {
      where.tagAssignments = { some: { tag: { name: filters.tag } } };
    }

    return this.prisma.asset.findMany({
      where,
      orderBy: ASSET_SORT_ORDER_BY[filters.sort ?? "createdAt_desc"],
      include: { tagAssignments: { include: { tag: true } } },
    });
  }

  async listTags(ownerId: string) {
    return this.prisma.assetTag.findMany({
      where: { ownerId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
  }

  async getOwned(assetId: string, ownerId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, ownerId, shareId: null, roomId: null },
    });

    if (!asset) throw new NotFoundException("Asset not found");
    return asset;
  }

  async removeOwned(assetId: string, ownerId: string) {
    const asset = await this.getOwned(assetId, ownerId);
    await this.remove(asset);
    this.recordActivity({
      actorId: ownerId,
      action: "asset.delete",
      targetId: assetId,
      metadata: { type: asset.type },
    });
  }

  async updateOwned(assetId: string, ownerId: string, data: UpdateAssetInput) {
    await this.getOwned(assetId, ownerId);

    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
        lastAccessedAt: new Date(),
      },
    });

    if (data.tags) {
      await this.replaceTags(assetId, ownerId, data.tags);
    }

    return asset;
  }

  async cloneOwned(
    assetId: string,
    owner: User,
    options: { container?: AssetContainer; source?: AssetSource } = {},
  ) {
    const asset = await this.getOwned(assetId, owner.id);
    const clone = await this.cloneAsset(asset, owner, options);
    this.recordActivity({
      actorId: owner.id,
      action: "asset.clone",
      targetId: clone.id,
      metadata: { type: clone.type, clonedFrom: assetId },
    });
    return clone;
  }

  async saveToLibrary(assetId: string, owner: User) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        OR: [
          { room: { is: { ownerId: owner.id } } },
          { share: { is: { creatorId: owner.id } } },
        ],
      },
    });
    if (!asset) throw new NotFoundException("Asset not found");

    const saved = await this.cloneAsset(asset, owner, {
      source: asset.source,
    });
    this.recordActivity({
      actorId: owner.id,
      action: "asset.save",
      targetId: saved.id,
      metadata: { type: saved.type, savedFrom: assetId },
    });
    return saved;
  }

  async createShareFromAsset(assetId: string, owner: User) {
    const sourceAsset = await this.getOwned(assetId, owner.id);
    const share = await this.prisma.share.create({
      data: {
        id: await this.createAvailableShareId(),
        uploadLocked: true,
        isZipReady: sourceAsset.type !== AssetType.FILE,
        expiration: this.getDefaultShareExpiration(),
        creator: { connect: { id: owner.id } },
        storageProvider:
          sourceAsset.type === AssetType.FILE
            ? sourceAsset.storage
            : this.config?.get("s3.enabled")
              ? "S3"
              : "LOCAL",
      },
    });
    const asset = await this.cloneAsset(sourceAsset, owner, {
      container: { id: share.id, kind: "SHARE" },
      source: AssetSource.SHARE,
    });

    return { share, asset };
  }

  async createShortLinkFromAsset(assetId: string, owner: User) {
    if (!this.shortLinkService) {
      throw new Error("Short link service is not configured");
    }

    const asset = await this.getOwned(assetId, owner.id);
    if (asset.type === AssetType.LINK) {
      return this.shortLinkService.create(
        {
          targetType: "URL",
          targetUrl: asset.url,
          title: asset.url,
        },
        owner,
      );
    }

    const { share } = await this.createShareFromAsset(assetId, owner);
    const title = asset.type === AssetType.FILE ? asset.name : asset.content;
    return this.shortLinkService.create(
      {
        targetType: "INTERNAL_PATH",
        targetUrl: `/s/${share.id}`,
        title: title?.slice(0, 80),
      },
      owner,
    );
  }

  async sendToRoom(assetId: string, roomId: string, owner: User) {
    const room = await this.prisma.room.findFirst({
      where: { roomId, ownerId: owner.id },
    });
    if (!room) throw new NotFoundException("Room not found");

    const asset = await this.getOwned(assetId, owner.id);
    const clone = await this.cloneAsset(asset, owner, {
      container: { id: room.id, kind: "ROOM" },
      source: AssetSource.ROOM,
    });
    roomChanges.next(roomId);
    return clone;
  }

  async remove(asset: Pick<Asset, "id" | "type" | "storage">) {
    const current = await this.prisma.asset.findUnique({
      where: { id: asset.id },
    });
    if (!current) return;
    await this.prisma.asset.delete({ where: { id: asset.id } });
    if (current.type === AssetType.FILE) {
      const storageKey = current.storageKey ?? current.id;
      const references = await this.prisma.asset.count({
        where: {
          type: AssetType.FILE,
          OR: [{ id: storageKey }, { storageKey }],
        },
      });
      if (references === 0) {
        await this.getStorage(current.storage).remove(storageKey);
      }
    }
  }

  async getOwnedDownloadStream(
    assetId: string,
    ownerId: string,
  ): Promise<{
    metaData: {
      id: string;
      size: string;
      createdAt: Date;
      mimeType: string;
      name: string;
    };
    file: Readable;
  }> {
    const asset = await this.getOwned(assetId, ownerId);
    return this.getDownloadStream(asset);
  }

  async getDownloadStream(
    asset: Pick<
      Asset,
      "createdAt" | "id" | "mimeType" | "name" | "size" | "storage" | "type"
    > & { storageKey?: string | null },
  ): Promise<{
    metaData: {
      id: string;
      size: string;
      createdAt: Date;
      mimeType: string;
      name: string;
    };
    file: Readable;
  }> {
    if (asset.type !== AssetType.FILE) {
      throw new BadRequestException("Asset is not downloadable");
    }

    return {
      metaData: {
        id: asset.id,
        size: asset.size,
        createdAt: asset.createdAt,
        mimeType: asset.mimeType || "application/octet-stream",
        name: asset.name,
      },
      file: await this.getStorage(asset.storage).getStream(
        asset.storageKey ?? asset.id,
      ),
    };
  }

  private getRelationData(owner?: User, container?: AssetContainer) {
    const isRoom = this.isRoomContainer(container);
    const isInboxSubmission =
      this.getContainerKind(container) === "INBOX_SUBMISSION";
    return {
      ...(owner ? { owner: { connect: { id: owner.id } } } : {}),
      ...(container && !isRoom && !isInboxSubmission
        ? { share: { connect: { id: container.id } } }
        : {}),
      ...(container && isRoom
        ? { room: { connect: { id: container.id } } }
        : {}),
      ...(container && isInboxSubmission
        ? { inboxSubmission: { connect: { id: container.id } } }
        : {}),
    };
  }

  private getSourceData(container?: AssetContainer) {
    const source = this.getAssetSource(container);
    return source ? { source } : {};
  }

  private getAssetSource(container?: AssetContainer) {
    if (!container) return undefined;
    if (this.getContainerKind(container) === "INBOX_SUBMISSION") {
      return AssetSource.INBOX;
    }
    if (this.isRoomContainer(container)) return AssetSource.ROOM;
    return AssetSource.SHARE;
  }

  private isRoomContainer(container?: AssetContainer) {
    return Boolean(
      container &&
        (this.getContainerKind(container) === "ROOM" || "roomId" in container),
    );
  }

  private getContainerKind(container?: AssetContainer) {
    if (!container || !("kind" in container)) return undefined;
    return container.kind;
  }

  private async cloneAsset(
    asset: Asset,
    owner: User,
    options: { container?: AssetContainer; source?: AssetSource } = {},
  ) {
    const id = crypto.randomUUID();

    return this.prisma.asset.create({
      data: {
        id,
        type: asset.type,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
        storage: asset.storage,
        storageKey:
          asset.type === AssetType.FILE ? (asset.storageKey ?? asset.id) : null,
        content: asset.content,
        url: asset.url,
        source:
          options.source ??
          this.getAssetSource(options.container) ??
          AssetSource.UPLOAD,
        ...this.getRelationData(owner, options.container),
      },
    });
  }

  private async replaceTags(assetId: string, ownerId: string, tags: string[]) {
    const normalizedTags = Array.from(
      new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
    );
    await this.prisma.assetTagAssignment.deleteMany({ where: { assetId } });
    if (normalizedTags.length === 0) return;

    const tagRecords = await Promise.all(
      normalizedTags.map((name) =>
        this.prisma.assetTag.upsert({
          where: { ownerId_name: { ownerId, name } },
          create: { name, owner: { connect: { id: ownerId } } },
          update: {},
        }),
      ),
    );

    await this.prisma.assetTagAssignment.createMany({
      data: tagRecords.map((tag) => ({ assetId, tagId: tag.id })),
    });
  }

  private async createAvailableShareId() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = createShareId();
      const result = await this.prisma.share.findUnique?.({ where: { id } });
      if (!result) return id;
    }
    throw new BadRequestException("Could not generate a share id");
  }

  private getDefaultShareExpiration() {
    const defaultExpiration = this.config?.get("share.defaultExpiration");
    if (defaultExpiration?.value && defaultExpiration?.unit) {
      return moment()
        .add(defaultExpiration.value, defaultExpiration.unit)
        .toDate();
    }
    return moment().add(7, "days").toDate();
  }

  private isValidUrl(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private getFileId(id?: string) {
    if (!id) return crypto.randomUUID();
    if (!isValidUUID(id)) {
      throw new BadRequestException("File asset id is invalid");
    }
    return id;
  }

  private getConfiguredStorageProvider() {
    return (
      this.storageService?.getConfiguredProvider() ??
      (this.config?.get("s3.enabled")
        ? StorageProvider.S3
        : StorageProvider.LOCAL)
    );
  }

  private getStorage(provider?: StorageProvider | null): AssetStorageService {
    if (provider === StorageProvider.S3 && this.s3Storage) {
      return this.s3Storage;
    }
    return this.localStorage;
  }
}
