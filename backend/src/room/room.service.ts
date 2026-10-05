import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from "@nestjs/common";
import {
  AccessPolicy,
  AssetType,
  Prisma,
  RoomVisibility,
  User,
} from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import * as argon from "argon2";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import { validate as isValidUUID } from "uuid";
import { Observable, filter, interval, map, merge } from "rxjs";
import { AccessPolicyService } from "src/accessPolicy/accessPolicy.service";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";
import { AssetService } from "src/asset/asset.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { roomChanges, roomListChanges } from "./room.events";

const createRoomId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
  8,
);

const inlineImageTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const previewTextExtensions = new Set([
  "txt",
  "text",
  "md",
  "markdown",
  "log",
  "json",
  "jsonl",
  "ndjson",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "svg",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "py",
  "java",
  "go",
  "rs",
  "c",
  "h",
  "cc",
  "cpp",
  "cxx",
  "hpp",
  "cs",
  "kt",
  "kts",
  "swift",
  "rb",
  "php",
  "pl",
  "lua",
  "r",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "bat",
  "cmd",
  "sql",
  "graphql",
  "gql",
  "csv",
  "tsv",
  "ini",
  "properties",
  "conf",
  "config",
  "toml",
  "env",
  "diff",
  "patch",
  "mk",
  "dockerfile",
  "makefile",
  "gradle",
  "dart",
  "ex",
  "exs",
  "erl",
  "hs",
]);
const maxTextPreviewBytes = 1024 * 1024;
const maxImagePreviewBytes = 20 * 1024 * 1024;
const maxPdfPreviewBytes = 25 * 1024 * 1024;

type RoomWithContent = Prisma.RoomGetPayload<{
  include: { assets: true; accessPolicy: true };
}>;

@Injectable()
export class RoomService {
  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private jwtService: JwtService,
    private config: ConfigService,
    private accessPolicyService: AccessPolicyService,
  ) {}

  private findRoom(roomId: string) {
    return this.prisma.room.findFirst({
      where: { roomId },
      include: { assets: true, accessPolicy: true },
    });
  }

  private async requireRoom(roomId: string) {
    const room = await this.findRoom(roomId);
    if (!room) throw new NotFoundException("Room not found");
    return room;
  }

  private async requireOwnedRoom(roomId: string, ownerId: string) {
    const room = await this.prisma.room.findFirst({
      where: { roomId, ownerId },
      include: { assets: true, accessPolicy: true },
    });
    if (!room) throw new NotFoundException("Room not found");
    return room;
  }

  async listOwned(ownerId: string) {
    await this.getOrCreatePrivate(ownerId);
    const rooms = await this.prisma.room.findMany({
      where: { ownerId },
      include: { assets: true, accessPolicy: true },
      orderBy: { updatedAt: "desc" },
    });
    return rooms
      .sort((a, b) =>
        a.visibility === b.visibility
          ? 0
          : a.visibility === RoomVisibility.PRIVATE
            ? -1
            : 1,
      )
      .map((room) => this.toResponse(room));
  }

  private async getOrCreatePrivate(ownerId: string) {
    const existing = await this.prisma.room.findFirst({
      where: { ownerId, visibility: RoomVisibility.PRIVATE },
    });
    if (existing) return existing;
    return this.prisma.room.create({
      data: {
        roomId: createRoomId(),
        visibility: RoomVisibility.PRIVATE,
        owner: { connect: { id: ownerId } },
      },
    });
  }

  async getOwned(roomId: string, ownerId: string) {
    return this.toResponse(await this.requireOwnedRoom(roomId, ownerId));
  }

  async create(
    data: {
      name?: string;
      passcode?: string;
      accessControl?: AccessControlDTO;
    },
    owner: User,
  ) {
    const room = await this.prisma.room.create({
      data: {
        roomId: createRoomId(),
        name: data.name?.trim() || null,
        passcodeHash: data.passcode ? await argon.hash(data.passcode) : null,
        owner: { connect: { id: owner.id } },
      },
    });
    if (data.accessControl) {
      await this.accessPolicyService.upsertForRelation(
        { roomId: room.id },
        data.accessControl,
      );
    }
    roomListChanges.next(owner.id);
    return this.getOwned(room.roomId, owner.id);
  }

  async update(
    roomId: string,
    data: {
      name?: string | null;
      passcode?: string | null;
      accessControl?: AccessControlDTO;
    },
    owner: User,
  ) {
    const existing = await this.requireOwnedRoom(roomId, owner.id);
    if (existing.visibility === RoomVisibility.PRIVATE) {
      throw new ForbiddenException("Private room settings cannot be changed");
    }
    await this.prisma.room.update({
      where: { roomId },
      data: {
        ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
        ...(data.passcode !== undefined
          ? {
              passcodeHash: data.passcode
                ? await argon.hash(data.passcode)
                : null,
            }
          : {}),
      },
    });
    if (data.accessControl) {
      await this.accessPolicyService.upsertForRelation(
        { roomId: existing.id },
        data.accessControl,
      );
    }
    roomChanges.next(roomId);
    roomListChanges.next(owner.id);
    return this.getOwned(roomId, owner.id);
  }

  async remove(roomId: string, owner: User) {
    const room = await this.requireOwnedRoom(roomId, owner.id);
    if (room.visibility === RoomVisibility.PRIVATE) {
      throw new ForbiddenException("Private room cannot be deleted");
    }
    for (const asset of room.assets) await this.assetService.remove(asset);
    await this.prisma.room.delete({ where: { roomId } });
    roomChanges.next(roomId);
    roomListChanges.next(owner.id);
  }

  /** A visitor entry may create one access session. Refreshes and events do not. */
  async open(roomId: string, token?: string, userId?: string | null) {
    const room = await this.requireRoom(roomId);
    if (room.visibility === RoomVisibility.PRIVATE)
      throw new NotFoundException("Room not found");
    if (this.verifyRoomToken(room, token)) {
      this.assertCurrentRules(room, userId);
      return { room: this.toResponse(room) };
    }
    this.accessPolicyService.assertAllowed(room.accessPolicy, { userId });
    if (room.passcodeHash)
      throw new ForbiddenException("Room passcode required");

    const limited = Boolean(
      room.accessPolicy?.oneTime || room.accessPolicy?.maxViews,
    );
    if (limited && room.accessPolicy) {
      await this.recordFirstView(room.accessPolicy);
      return {
        room: this.toResponse(room),
        token: this.generateRoomToken(room),
      };
    }
    return { room: this.toResponse(room) };
  }

  async getForRead(
    roomId: string,
    token?: string,
    userId?: string | null,
    options: { requireDownload?: boolean; allowOwner?: boolean } = {},
  ) {
    const room = await this.requireRoom(roomId);
    if (options.allowOwner && userId && room.ownerId === userId) {
      return this.toResponse(room);
    }
    if (room.visibility === RoomVisibility.PRIVATE)
      throw new NotFoundException("Room not found");
    this.assertCurrentRules(room, userId, options.requireDownload);
    const requiresToken = Boolean(
      room.passcodeHash ||
        room.accessPolicy?.oneTime ||
        room.accessPolicy?.maxViews,
    );
    if (requiresToken && !this.verifyRoomToken(room, token)) {
      throw new ForbiddenException("Room access token required");
    }
    return this.toResponse(room);
  }

  async verifyPasscode(
    roomId: string,
    passcode?: string,
    userId?: string | null,
  ) {
    const room = await this.requireRoom(roomId);
    if (room.visibility === RoomVisibility.PRIVATE)
      throw new NotFoundException("Room not found");
    this.accessPolicyService.assertAllowed(room.accessPolicy, { userId });
    if (room.passcodeHash) {
      if (!passcode || !(await argon.verify(room.passcodeHash, passcode))) {
        throw new ForbiddenException("Invalid room passcode");
      }
    }
    if (room.accessPolicy?.oneTime || room.accessPolicy?.maxViews) {
      await this.recordFirstView(room.accessPolicy);
    }
    return this.generateRoomToken(room);
  }

  roomEvents(roomId: string): Observable<MessageEvent> {
    return merge(
      roomChanges.pipe(
        filter((changedRoomId) => changedRoomId === roomId),
        map(() => ({ data: { changed: true } })),
      ),
      interval(25000).pipe(map(() => ({ data: "", comment: "keepalive" }))),
    );
  }

  ownerListEvents(ownerId: string): Observable<MessageEvent> {
    return merge(
      roomListChanges.pipe(
        filter((changedOwnerId) => changedOwnerId === ownerId),
        map(() => ({ data: { changed: true } })),
      ),
      interval(25000).pipe(map(() => ({ data: "", comment: "keepalive" }))),
    );
  }

  async addAsset(
    roomId: string,
    data: {
      type: "TEXT" | "LINK";
      content?: string;
      url?: string;
      roomBatchId?: string;
    },
    user: User,
    token?: string,
  ) {
    this.assertRoomBatchId(data.roomBatchId);
    const room = await this.requireWritableRoom(roomId, user, token);
    this.assertRoomBatchOwner(room, data.roomBatchId, user.id);
    let asset;
    if (data.type === "TEXT") {
      asset = await this.assetService.createText(
        { content: data.content },
        user,
        room,
        data.roomBatchId,
      );
    } else if (data.type === "LINK") {
      asset = await this.assetService.createLink(
        { url: data.url },
        user,
        room,
        data.roomBatchId,
      );
    } else {
      throw new BadRequestException("Unsupported room asset type");
    }
    roomChanges.next(roomId);
    return asset;
  }

  async addFile(
    roomId: string,
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    user: User,
    token?: string,
    roomBatchId?: string,
  ) {
    this.assertRoomBatchId(roomBatchId);
    const room = await this.requireWritableRoom(roomId, user, token);
    this.assertRoomBatchOwner(room, roomBatchId, user.id);
    const asset = await this.assetService.createFile(
      data,
      chunk,
      file,
      user,
      room,
      false,
      roomBatchId,
    );
    if ("type" in asset && asset.type === AssetType.FILE)
      roomChanges.next(roomId);
    return asset;
  }

  private assertRoomBatchId(roomBatchId?: string) {
    if (roomBatchId !== undefined && !isValidUUID(roomBatchId)) {
      throw new BadRequestException("Invalid room batch id");
    }
  }

  private assertRoomBatchOwner(
    room: RoomWithContent,
    roomBatchId: string | undefined,
    userId: string,
  ) {
    if (
      roomBatchId &&
      room.assets.some(
        (asset) =>
          asset.roomBatchId === roomBatchId && asset.ownerId !== userId,
      )
    ) {
      throw new ForbiddenException("Room batch belongs to another user");
    }
  }

  async getFileDownload(
    roomId: string,
    assetId: string,
    token?: string,
    userId?: string | null,
    previewMode?: "image" | "text" | "pdf",
  ) {
    const room = await this.getForRead(roomId, token, userId, {
      requireDownload: !previewMode,
      allowOwner: true,
    });
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        type: AssetType.FILE,
        roomId: room.id,
        shareId: null,
      },
    });
    if (!asset) throw new NotFoundException("Asset not found");
    if (
      previewMode === "image" &&
      (!inlineImageTypes.has((asset.mimeType || "").toLowerCase()) ||
        Number(asset.size) > maxImagePreviewBytes)
    ) {
      throw new BadRequestException("Image preview unavailable");
    }
    if (previewMode === "text") {
      const basename = asset.name?.split(/[\\/]/).pop()?.toLowerCase() || "";
      const extension = basename.split(".").pop() || "";
      const mime = (asset.mimeType || "").toLowerCase();
      const hasTextMime =
        mime.startsWith("text/") ||
        mime === "application/json" ||
        mime.endsWith("+json") ||
        mime === "application/xml" ||
        mime.endsWith("+xml") ||
        mime.includes("yaml");
      if (
        !(
          previewTextExtensions.has(extension) ||
          basename.startsWith(".env") ||
          hasTextMime
        ) ||
        !asset.size ||
        Number(asset.size) > maxTextPreviewBytes
      ) {
        throw new BadRequestException("Text preview unavailable");
      }
    }
    if (
      previewMode === "pdf" &&
      (asset.mimeType !== "application/pdf" ||
        !asset.name?.toLowerCase().endsWith(".pdf") ||
        Number(asset.size) > maxPdfPreviewBytes)
    ) {
      throw new BadRequestException("PDF preview unavailable");
    }
    return this.assetService.getDownloadStream(asset);
  }

  async removeAsset(roomId: string, assetId: string, owner: User) {
    const room = await this.requireOwnedRoom(roomId, owner.id);
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, roomId: room.id, shareId: null },
    });
    if (!asset) throw new NotFoundException("Asset not found");
    await this.assetService.remove(asset);
    roomChanges.next(roomId);
  }

  async removeAssets(roomId: string, owner: User, ids?: string[]) {
    const room = await this.requireOwnedRoom(roomId, owner.id);
    const selected = ids ? new Set(ids) : null;
    const assets = room.assets.filter(
      (asset) =>
        asset.shareId === null && (!selected || selected.has(asset.id)),
    );
    for (const asset of assets) await this.assetService.remove(asset);
    if (assets.length) roomChanges.next(roomId);
    return { deletedIds: assets.map((asset) => asset.id) };
  }

  private async requireWritableRoom(
    roomId: string,
    user: User,
    token?: string,
  ) {
    const room = await this.requireRoom(roomId);
    if (room.ownerId !== user.id) {
      if (room.visibility === RoomVisibility.PRIVATE)
        throw new NotFoundException("Room not found");
      await this.getForRead(roomId, token, user.id);
    }
    return room;
  }

  private assertCurrentRules(
    room: RoomWithContent,
    userId?: string | null,
    requireDownload?: boolean,
  ) {
    const policy = room.accessPolicy;
    this.accessPolicyService.assertAllowed(
      policy ? { ...policy, maxViews: null, oneTime: false } : null,
      { userId, requireDownload },
    );
  }

  private async recordFirstView(policy: AccessPolicy) {
    const limit = policy.oneTime ? 1 : policy.maxViews;
    if (limit !== null && limit !== undefined) {
      const result = await this.prisma.accessPolicy.updateMany({
        where: { id: policy.id, views: { lt: limit } },
        data: { views: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ForbiddenException("Access limit exceeded");
      return;
    }
    await this.accessPolicyService.recordView(policy);
  }

  private generateRoomToken(room: RoomWithContent) {
    return this.jwtService.sign(
      {
        roomId: room.roomId,
        createdAt: new Date(room.createdAt).getTime(),
        passcodeSignature: this.signature(room.passcodeHash ?? ""),
        policySignature: this.policySignature(room.accessPolicy),
      },
      { expiresIn: "24h", secret: this.config.get("internal.jwtSecret") },
    );
  }

  private verifyRoomToken(room: RoomWithContent, token?: string) {
    if (!token) return false;
    try {
      const claims = this.jwtService.verify(token, {
        secret: this.config.get("internal.jwtSecret"),
      });
      return (
        claims.roomId === room.roomId &&
        claims.createdAt === new Date(room.createdAt).getTime() &&
        claims.passcodeSignature === this.signature(room.passcodeHash ?? "") &&
        claims.policySignature === this.policySignature(room.accessPolicy)
      );
    } catch {
      return false;
    }
  }

  private policySignature(policy: AccessPolicy | null) {
    if (!policy) return this.signature("");
    return this.signature(
      JSON.stringify({
        id: policy.id,
        passwordHash: policy.passwordHash,
        expiresAt: policy.expiresAt,
        maxViews: policy.maxViews,
        allowDownload: policy.allowDownload,
        allowAnonymous: policy.allowAnonymous,
        oneTime: policy.oneTime,
      }),
    );
  }

  private signature(value: string) {
    return crypto
      .createHmac("sha256", this.config.get("internal.jwtSecret"))
      .update(value)
      .digest("hex");
  }

  private toResponse(room: RoomWithContent) {
    const { passcodeHash, accessPolicy, ...rest } = room;
    return {
      ...rest,
      hasPasscode: Boolean(passcodeHash),
      accessControl: accessPolicy
        ? {
            expiresAt: accessPolicy.expiresAt?.toISOString() ?? null,
            maxViews: accessPolicy.maxViews,
            views: accessPolicy.views,
            allowDownload: accessPolicy.allowDownload,
            allowAnonymous: accessPolicy.allowAnonymous,
            oneTime: accessPolicy.oneTime,
          }
        : null,
    };
  }
}
