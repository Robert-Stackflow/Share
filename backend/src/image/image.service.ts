import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  Asset,
  HostedImage,
  ImagePreference,
  ImageVariantKind,
  ImageVisibility,
  Prisma,
  User,
} from "@prisma/client";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import * as path from "path";
import { Readable } from "stream";
import * as sharp from "sharp";
import { AssetService } from "src/asset/asset.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateImageAlbumDTO, UpdateImageAlbumDTO } from "./dto/imageAlbum.dto";
import { UpdateImagePreferenceDTO } from "./dto/imagePreference.dto";
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import {
  DEFAULT_HOSTED_IMAGE_PAGE_SIZE,
  DEFAULT_MAX_HOSTED_IMAGE_BYTES,
  HOSTED_IMAGE_MIME_TYPES,
  HostedImagePage,
  HostedImageSort,
  HostedImageStats,
  ImageOutputFormat,
  ListHostedImageQuery,
  MAX_HOSTED_IMAGE_BATCH_SIZE,
  MAX_HOSTED_IMAGE_HARD_BYTES,
  MAX_HOSTED_IMAGE_PAGE_SIZE,
} from "./image.types";

type HostedImageWithRelations = HostedImage & {
  asset: Asset & {
    tagAssignments?: Array<{ tag: { name: string } }>;
    owner?: { id: string; username: string; email: string } | null;
  };
  album?: { id: string; name: string } | null;
  variants?: Array<{
    id: string;
    kind: ImageVariantKind;
    width: number;
    height: number;
    mimeType: string;
    size: string;
    asset: Asset;
  }>;
  owner?: { id: string; username: string; email: string } | null;
};

type ProcessedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: (typeof HOSTED_IMAGE_MIME_TYPES)[number];
  transformed: boolean;
};

type GeneratedThumbnail = {
  data: Buffer;
  width: number;
  height: number;
};

type AdminListHostedImageQuery = ListHostedImageQuery & { ownerId?: string };

const createSlug = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  12,
);

const IMAGE_INCLUDE = {
  asset: { include: { tagAssignments: { include: { tag: true } } } },
  album: { select: { id: true, name: true } },
  variants: { include: { asset: true } },
} satisfies Prisma.HostedImageInclude;

const FORMAT_MIME_TYPES: Record<
  string,
  (typeof HOSTED_IMAGE_MIME_TYPES)[number]
> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heif: "image/avif",
};

const OUTPUT_MIME_TYPES: Record<
  Exclude<ImageOutputFormat, "ORIGINAL">,
  (typeof HOSTED_IMAGE_MIME_TYPES)[number]
> = {
  JPEG: "image/jpeg",
  PNG: "image/png",
  WEBP: "image/webp",
  AVIF: "image/avif",
};

const OUTPUT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    user: User,
    visibility?: ImageVisibility,
    albumId?: string,
  ) {
    this.assertUploadEnabled();
    if (!file?.buffer?.length) {
      throw new BadRequestException("An image file is required");
    }
    const maxSize = this.getMaxUploadBytes();
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Image must be ${this.formatBytes(maxSize)} or smaller`,
      );
    }

    const sourceMetadata = await this.readImageMetadata(file.buffer);
    const sourceMimeType = this.getMimeType(
      sourceMetadata.format,
      file.mimetype,
    );
    if (!sourceMimeType || !sourceMetadata.width || !sourceMetadata.height) {
      throw new BadRequestException(
        "Only JPEG, PNG, WebP, GIF and AVIF images are supported",
      );
    }
    const sourceHeight = sourceMetadata.pageHeight ?? sourceMetadata.height;
    if (
      sourceMetadata.width * sourceMetadata.height >
      this.getMaxInputPixels()
    ) {
      throw new BadRequestException(
        "Image dimensions exceed the allowed limit",
      );
    }

    const preference = await this.getPreference(user.id);
    const resolvedVisibility = this.resolveVisibility(
      visibility ?? preference.defaultVisibility,
    );
    if (albumId) await this.getOwnedAlbum(albumId, user.id);
    const checksum = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");
    if (preference.deduplicate) {
      const duplicate = await this.prisma.hostedImage.findFirst({
        where: {
          checksum,
          deletedAt: null,
          visibility: resolvedVisibility,
          albumId: albumId ?? null,
          asset: { ownerId: user.id },
        },
        include: IMAGE_INCLUDE,
      });
      if (duplicate) return duplicate;
    }

    await this.assertUploadRate(user.id);

    const processed = await this.processImage(
      file.buffer,
      sourceMimeType,
      sourceMetadata.pages ?? 1,
      preference,
    );
    const thumbnail = await this.generateThumbnail(processed.buffer);
    await this.assertQuota(
      user.id,
      processed.buffer.length +
        thumbnail.data.length +
        (processed.transformed ? file.buffer.length : 0),
    );

    const name = this.normalizeFileName(file.originalname, processed.mimeType);
    const createdAssets: Asset[] = [];
    let hostedImage: HostedImageWithRelations | undefined;

    try {
      const asset = (await this.assets.createFile(
        processed.buffer,
        { index: 0, total: 1 },
        { name },
        user,
      )) as Asset;
      createdAssets.push(asset);

      if (asset.mimeType !== processed.mimeType || asset.name !== name) {
        await this.prisma.asset.update({
          where: { id: asset.id },
          data: { mimeType: processed.mimeType, name },
        });
      }

      const slug = await this.createAvailableSlug();
      hostedImage = (await this.prisma.hostedImage.create({
        data: {
          slug,
          visibility: resolvedVisibility,
          width: processed.width,
          height: processed.height,
          checksum,
          ...(albumId ? { album: { connect: { id: albumId } } } : {}),
          asset: { connect: { id: asset.id } },
        },
        include: IMAGE_INCLUDE,
      })) as HostedImageWithRelations;

      if (processed.transformed) {
        const originalAsset = (await this.assets.createFile(
          file.buffer,
          { index: 0, total: 1 },
          { name: this.normalizeFileName(file.originalname, sourceMimeType) },
        )) as Asset;
        createdAssets.push(originalAsset);
        await this.prisma.asset.update({
          where: { id: originalAsset.id },
          data: { mimeType: sourceMimeType },
        });
        await this.prisma.imageVariant.create({
          data: {
            kind: ImageVariantKind.ORIGINAL,
            width: sourceMetadata.width,
            height: sourceHeight,
            mimeType: sourceMimeType,
            size: file.buffer.length.toString(),
            hostedImage: { connect: { id: hostedImage.id } },
            asset: { connect: { id: originalAsset.id } },
          },
        });
      }

      const thumbnailVariant = await this.createThumbnail(
        hostedImage.id,
        processed.buffer,
        slug,
        thumbnail,
      );
      createdAssets.push(thumbnailVariant.asset);
      return this.getOwned(hostedImage.id, user.id);
    } catch (error) {
      if (hostedImage) {
        await this.prisma.hostedImage
          .delete({ where: { id: hostedImage.id } })
          .catch(() => undefined);
      }
      for (const asset of createdAssets.reverse()) {
        await this.assets.remove(asset).catch(() => undefined);
      }
      throw error;
    }
  }

  async list(
    userId: string,
    query: ListHostedImageQuery = {},
  ): Promise<HostedImagePage<HostedImageWithRelations>> {
    return this.listWithWhere(
      {
        asset: {
          ownerId: userId,
          shareId: null,
          roomId: null,
          ...(query.favorite !== undefined ? { favorite: query.favorite } : {}),
          ...(query.tag
            ? { tagAssignments: { some: { tag: { name: query.tag } } } }
            : {}),
        },
      },
      query,
    );
  }

  async listAdmin(query: AdminListHostedImageQuery = {}) {
    return this.listWithWhere(
      query.ownerId ? { asset: { ownerId: query.ownerId } } : {},
      query,
      true,
    );
  }

  async stats(userId: string): Promise<HostedImageStats> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        count: number | bigint | null;
        publicCount: number | bigint | null;
        privateCount: number | bigint | null;
        totalSize: number | bigint | null;
        views: number | bigint | null;
      }>
    >`
      SELECT
        COUNT(*) AS count,
        SUM(CASE WHEN hi.visibility = 'PUBLIC' THEN 1 ELSE 0 END) AS publicCount,
        SUM(CASE WHEN hi.visibility = 'PRIVATE' THEN 1 ELSE 0 END) AS privateCount,
        SUM(
          CAST(COALESCE(a.size, '0') AS INTEGER) +
          COALESCE((
            SELECT SUM(CAST(COALESCE(va.size, '0') AS INTEGER))
            FROM ImageVariant iv
            INNER JOIN Asset va ON va.id = iv.assetId
            WHERE iv.hostedImageId = hi.id
          ), 0)
        ) AS totalSize,
        SUM(hi.views) AS views
      FROM HostedImage hi
      INNER JOIN Asset a ON a.id = hi.assetId
      WHERE a.ownerId = ${userId} AND hi.deletedAt IS NULL
    `;
    return this.normalizeStats(rows[0]);
  }

  async adminStats(): Promise<HostedImageStats & { users: number }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        count: number | bigint | null;
        publicCount: number | bigint | null;
        privateCount: number | bigint | null;
        totalSize: number | bigint | null;
        views: number | bigint | null;
        users: number | bigint | null;
      }>
    >`
      SELECT
        COUNT(*) AS count,
        SUM(CASE WHEN hi.visibility = 'PUBLIC' THEN 1 ELSE 0 END) AS publicCount,
        SUM(CASE WHEN hi.visibility = 'PRIVATE' THEN 1 ELSE 0 END) AS privateCount,
        SUM(
          CAST(COALESCE(a.size, '0') AS INTEGER) +
          COALESCE((
            SELECT SUM(CAST(COALESCE(va.size, '0') AS INTEGER))
            FROM ImageVariant iv
            INNER JOIN Asset va ON va.id = iv.assetId
            WHERE iv.hostedImageId = hi.id
          ), 0)
        ) AS totalSize,
        SUM(hi.views) AS views,
        COUNT(DISTINCT a.ownerId) AS users
      FROM HostedImage hi
      INNER JOIN Asset a ON a.id = hi.assetId
      WHERE hi.deletedAt IS NULL
    `;
    return {
      ...this.normalizeStats(rows[0]),
      users: Number(rows[0]?.users ?? 0),
    };
  }

  async update(id: string, userId: string, input: UpdateHostedImageDTO) {
    const image = await this.getOwned(id, userId, true);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException("Image name is required");
    }
    if (input.visibility) this.assertVisibilityAllowed(input.visibility);
    if (input.albumId) await this.getOwnedAlbum(input.albumId, userId);

    await this.prisma.hostedImage.update({
      where: { id: image.id },
      data: {
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.albumId !== undefined
          ? {
              album: input.albumId
                ? { connect: { id: input.albumId } }
                : { disconnect: true },
            }
          : {}),
        ...(name ? { asset: { update: { name } } } : {}),
      },
    });
    if (input.favorite !== undefined || input.tags !== undefined) {
      await this.assets.updateOwned(image.assetId, userId, {
        ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      });
    }
    return this.getOwned(id, userId, true);
  }

  async updateBatch(
    ids: string[],
    userId: string,
    input: { visibility?: ImageVisibility; albumId?: string | null },
  ) {
    const images = await this.getOwnedBatch(ids, userId, true);
    if (input.visibility) this.assertVisibilityAllowed(input.visibility);
    if (input.albumId) await this.getOwnedAlbum(input.albumId, userId);
    if (input.visibility === undefined && input.albumId === undefined) {
      throw new BadRequestException("A batch change is required");
    }

    await this.prisma.hostedImage.updateMany({
      where: { id: { in: images.map((image) => image.id) } },
      data: {
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.albumId !== undefined ? { albumId: input.albumId } : {}),
      },
    });
    return this.prisma.hostedImage.findMany({
      where: { id: { in: images.map((image) => image.id) } },
      include: IMAGE_INCLUDE,
    });
  }

  async remove(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    await this.prisma.hostedImage.update({
      where: { id: image.id },
      data: { deletedAt: new Date() },
    });
  }

  async removeBatch(ids: string[], userId: string) {
    const images = await this.getOwnedBatch(ids, userId);
    const { count } = await this.prisma.hostedImage.updateMany({
      where: { id: { in: images.map((image) => image.id) } },
      data: { deletedAt: new Date() },
    });
    return count;
  }

  async restore(id: string, userId: string) {
    const image = await this.getOwned(id, userId, true);
    return this.prisma.hostedImage.update({
      where: { id: image.id },
      data: { deletedAt: null },
      include: IMAGE_INCLUDE,
    });
  }

  async restoreBatch(ids: string[], userId: string) {
    const images = await this.getOwnedBatch(ids, userId, true);
    const { count } = await this.prisma.hostedImage.updateMany({
      where: { id: { in: images.map((image) => image.id) } },
      data: { deletedAt: null },
    });
    return count;
  }

  async destroy(id: string, userId: string) {
    const image = await this.getOwned(id, userId, true);
    await this.destroyImage(image);
  }

  async destroyAdmin(id: string) {
    const image = await this.prisma.hostedImage.findUnique({
      where: { id },
      include: IMAGE_INCLUDE,
    });
    if (!image) throw new NotFoundException("Image not found");
    await this.destroyImage(image as HostedImageWithRelations);
  }

  async updateBatchAdmin(ids: string[], visibility: ImageVisibility) {
    const images = await this.getAdminBatch(ids);
    this.assertVisibilityAllowed(visibility);
    const { count } = await this.prisma.hostedImage.updateMany({
      where: { id: { in: images.map((image) => image.id) } },
      data: { visibility },
    });
    return count;
  }

  async destroyBatchAdmin(ids: string[]) {
    const images = await this.getAdminBatch(ids);
    for (const image of images) await this.destroyImage(image);
    return images.length;
  }

  async createAlbum(userId: string, input: CreateImageAlbumDTO) {
    const name = input.name.trim();
    try {
      return await this.prisma.imageAlbum.create({
        data: {
          name,
          description: input.description?.trim() || null,
          owner: { connect: { id: userId } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An album with this name already exists");
      }
      throw error;
    }
  }

  async listAlbums(userId: string) {
    const albums = await this.prisma.imageAlbum.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { images: { where: { deletedAt: null } } },
        },
        images: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { variants: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return albums.map((album) => ({
      id: album.id,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
      name: album.name,
      description: album.description,
      imageCount: album._count.images,
      coverImageId: album.images[0]?.id ?? null,
      coverUrl: album.images[0]
        ? `/api/images/${album.images[0].id}/thumbnail`
        : null,
    }));
  }

  async updateAlbum(id: string, userId: string, input: UpdateImageAlbumDTO) {
    await this.getOwnedAlbum(id, userId);
    return this.prisma.imageAlbum.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
      },
    });
  }

  async removeAlbum(id: string, userId: string) {
    await this.getOwnedAlbum(id, userId);
    await this.prisma.imageAlbum.delete({ where: { id } });
  }

  async getPreference(userId: string): Promise<ImagePreference> {
    const existing = await this.prisma.imagePreference.findUnique({
      where: { userId },
    });
    if (existing) {
      return !this.config.get("images.allowPublic") &&
        existing.defaultVisibility === ImageVisibility.PUBLIC
        ? { ...existing, defaultVisibility: ImageVisibility.PRIVATE }
        : existing;
    }
    return this.prisma.imagePreference.create({
      data: {
        userId,
        defaultVisibility:
          this.config.get("images.allowPublic") &&
          this.config.get("images.defaultPublic")
            ? ImageVisibility.PUBLIC
            : ImageVisibility.PRIVATE,
      },
    });
  }

  async updatePreference(userId: string, input: UpdateImagePreferenceDTO) {
    if (
      input.defaultVisibility === ImageVisibility.PUBLIC &&
      !this.config.get("images.allowPublic")
    ) {
      throw new ForbiddenException(
        "Public image links are disabled by the administrator",
      );
    }
    if (!this.config.get("images.allowProcessing")) {
      const changesProcessing = Object.keys(input).some(
        (key) => !["defaultVisibility", "deduplicate"].includes(key),
      );
      if (changesProcessing) {
        throw new ForbiddenException(
          "Image processing preferences are disabled by the administrator",
        );
      }
    }

    return this.prisma.imagePreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  }

  assertApiUploadEnabled() {
    if (!this.config.get("images.apiUploadEnabled")) {
      throw new ServiceUnavailableException(
        "Image API uploads are disabled by the administrator",
      );
    }
  }

  getMaxUploadBytes() {
    const configured = Number(this.config.get("images.maxSize"));
    if (!Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_MAX_HOSTED_IMAGE_BYTES;
    }
    return Math.min(configured, MAX_HOSTED_IMAGE_HARD_BYTES);
  }

  getPublicCacheControl() {
    const maxAge = Math.max(
      0,
      Number(this.config.get("images.cacheMaxAge")) || 0,
    );
    return `public, max-age=${maxAge}${maxAge >= 86400 ? ", immutable" : ""}`;
  }

  async getOwnedContent(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    return this.assets.getDownloadStream(image.asset);
  }

  async getOriginalContent(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    const original = image.variants?.find(
      (variant) => variant.kind === ImageVariantKind.ORIGINAL,
    );
    return this.assets.getDownloadStream(original?.asset ?? image.asset);
  }

  async getOwnedThumbnail(id: string, userId: string) {
    // Keep previews available in the recycle bin without exposing them
    // publicly. Ownership is still required by the controller guard.
    const image = await this.getOwned(id, userId, true);
    return this.getThumbnail(image);
  }

  async getAdminThumbnail(id: string) {
    return this.getThumbnail(await this.getAdmin(id));
  }

  async getAdminContent(id: string) {
    const image = await this.getAdmin(id);
    return this.assets.getDownloadStream(image.asset);
  }

  async getAdminOriginalContent(id: string) {
    const image = await this.getAdmin(id);
    const original = image.variants?.find(
      (variant) => variant.kind === ImageVariantKind.ORIGINAL,
    );
    return this.assets.getDownloadStream(original?.asset ?? image.asset);
  }

  async getPublicContent(slug: string) {
    const image = await this.getPublic(slug);
    this.recordView(image.id);
    return this.assets.getDownloadStream(image.asset);
  }

  async getPublicThumbnail(slug: string) {
    const image = await this.getPublic(slug);
    return this.getThumbnail(image);
  }

  toResponse(
    image: HostedImageWithRelations,
    requestOrigin: string,
    options: { admin?: boolean } = {},
  ) {
    const path = `/i/${image.slug}`;
    const origin = this.getPublicOrigin(requestOrigin);
    const url =
      image.visibility === ImageVisibility.PUBLIC && !image.deletedAt
        ? `${origin}${path}`
        : null;
    const thumbnail = image.variants?.find(
      (variant) => variant.kind === ImageVariantKind.THUMBNAIL,
    );
    const original = image.variants?.find(
      (variant) => variant.kind === ImageVariantKind.ORIGINAL,
    );

    return {
      id: image.id,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      deletedAt: image.deletedAt,
      slug: image.slug,
      visibility: image.visibility,
      width: image.width,
      height: image.height,
      checksum: image.checksum,
      views: image.views,
      lastViewedAt: image.lastViewedAt,
      name: image.asset.name,
      size: image.asset.size,
      mimeType: image.asset.mimeType,
      favorite: image.asset.favorite,
      tags:
        image.asset.tagAssignments?.map((assignment) => assignment.tag.name) ??
        [],
      album: image.album ?? null,
      url,
      path: url ? path : null,
      contentUrl: options.admin
        ? `/api/admin/images/${image.id}/content`
        : `/api/images/${image.id}/content`,
      thumbnailUrl: url
        ? `${origin}${path}/thumbnail`
        : options.admin
          ? `/api/admin/images/${image.id}/thumbnail`
          : `/api/images/${image.id}/thumbnail`,
      originalUrl: options.admin
        ? `/api/admin/images/${image.id}/original`
        : `/api/images/${image.id}/original`,
      hasOriginal: Boolean(original),
      thumbnail: thumbnail
        ? {
            width: thumbnail.width,
            height: thumbnail.height,
            size: thumbnail.size,
            mimeType: thumbnail.mimeType,
          }
        : null,
      links: url
        ? {
            direct: url,
            markdown: `![${image.asset.name ?? "image"}](${url})`,
            html: `<img src="${url}" alt="${this.escapeHtml(
              image.asset.name ?? "image",
            )}">`,
            bbcode: `[img]${url}[/img]`,
          }
        : null,
      ...(options.admin && image.owner ? { owner: image.owner } : {}),
    };
  }

  @Cron("30 2 * * *")
  async purgeExpiredTrash() {
    const retentionDays = Math.max(
      1,
      Number(this.config.get("images.recycleRetentionDays")) || 30,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const images = await this.prisma.hostedImage.findMany({
      where: { deletedAt: { lt: cutoff } },
      include: IMAGE_INCLUDE,
      take: 100,
    });
    for (const image of images) {
      await this.destroyImage(image as HostedImageWithRelations);
    }
    if (images.length) {
      this.logger.log(
        `Purged ${images.length} expired images from recycle bin`,
      );
    }
  }

  private async listWithWhere(
    baseWhere: Prisma.HostedImageWhereInput,
    query: ListHostedImageQuery,
    admin = false,
  ): Promise<HostedImagePage<HostedImageWithRelations>> {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_HOSTED_IMAGE_PAGE_SIZE, 1),
      MAX_HOSTED_IMAGE_PAGE_SIZE,
    );
    const searchConditions: Prisma.HostedImageWhereInput[] = query.q
      ? [
          { slug: { contains: query.q } },
          { asset: { name: { contains: query.q } } },
          ...(admin
            ? [
                { asset: { owner: { username: { contains: query.q } } } },
                { asset: { owner: { email: { contains: query.q } } } },
              ]
            : []),
        ]
      : [];
    const where: Prisma.HostedImageWhereInput = {
      ...baseWhere,
      deletedAt: query.trashed ? { not: null } : null,
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.albumId ? { albumId: query.albumId } : {}),
      ...(searchConditions.length ? { OR: searchConditions } : {}),
    };
    const items = (await this.prisma.hostedImage.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: this.getOrderBy(query.sort),
      include: {
        ...IMAGE_INCLUDE,
        ...(admin
          ? {
              asset: {
                include: {
                  owner: { select: { id: true, username: true, email: true } },
                  tagAssignments: { include: { tag: true } },
                },
              },
            }
          : {}),
      },
    })) as unknown as HostedImageWithRelations[];
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    if (admin) {
      for (const image of items) image.owner = image.asset.owner ?? null;
    }
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private getOrderBy(sort: HostedImageSort = "createdAt_desc") {
    if (sort === "createdAt_asc")
      return [{ createdAt: "asc" as const }, { id: "asc" as const }];
    if (sort === "name_asc")
      return [{ asset: { name: "asc" as const } }, { id: "asc" as const }];
    if (sort === "name_desc")
      return [{ asset: { name: "desc" as const } }, { id: "desc" as const }];
    return [{ createdAt: "desc" as const }, { id: "desc" as const }];
  }

  private async processImage(
    buffer: Buffer,
    sourceMimeType: (typeof HOSTED_IMAGE_MIME_TYPES)[number],
    pages: number,
    preference: ImagePreference,
  ): Promise<ProcessedImage> {
    const sourceMetadata = await this.readImageMetadata(buffer);
    const processingAllowed =
      this.config.get("images.allowProcessing") === true;
    const animated = pages > 1;
    const transformRequested =
      processingAllowed &&
      !animated &&
      (preference.autoOrient ||
        preference.stripMetadata ||
        preference.outputFormat !== "ORIGINAL" ||
        Boolean(preference.maxWidth) ||
        (preference.watermarkEnabled && Boolean(preference.watermarkText)));

    if (!transformRequested) {
      return {
        buffer,
        width: sourceMetadata.width!,
        height: sourceMetadata.pageHeight ?? sourceMetadata.height!,
        mimeType: sourceMimeType,
        transformed: false,
      };
    }

    let pipeline = sharp(buffer, {
      limitInputPixels: this.getMaxInputPixels(),
    });
    if (preference.autoOrient) pipeline = pipeline.rotate();
    if (preference.maxWidth) {
      pipeline = pipeline.resize({
        width: preference.maxWidth,
        withoutEnlargement: true,
      });
    }
    if (!preference.stripMetadata) pipeline = pipeline.keepMetadata();

    if (preference.watermarkEnabled && preference.watermarkText) {
      const width = Math.min(
        preference.maxWidth ?? sourceMetadata.width!,
        sourceMetadata.width!,
      );
      pipeline = pipeline.composite([
        {
          input: this.createTextWatermark(
            preference.watermarkText,
            width,
            preference.watermarkOpacity,
          ),
          gravity: preference.watermarkPosition as sharp.Gravity,
        },
      ]);
    }

    const outputFormat = preference.outputFormat as ImageOutputFormat;
    const targetMimeType =
      outputFormat === "ORIGINAL"
        ? sourceMimeType
        : OUTPUT_MIME_TYPES[outputFormat];
    pipeline = this.applyOutputFormat(
      pipeline,
      targetMimeType,
      preference.quality,
    );
    const result = await pipeline.toBuffer({ resolveWithObject: true });
    const mimeType = this.getMimeType(result.info.format, targetMimeType);
    if (!mimeType) throw new BadRequestException("Image processing failed");
    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      mimeType,
      transformed: true,
    };
  }

  private applyOutputFormat(
    pipeline: sharp.Sharp,
    mimeType: (typeof HOSTED_IMAGE_MIME_TYPES)[number],
    quality: number,
  ) {
    if (mimeType === "image/jpeg") return pipeline.jpeg({ quality });
    if (mimeType === "image/png") return pipeline.png({ quality });
    if (mimeType === "image/webp") return pipeline.webp({ quality });
    if (mimeType === "image/avif") return pipeline.avif({ quality });
    return pipeline.gif();
  }

  private createTextWatermark(text: string, width: number, opacity: number) {
    const fontSize = Math.max(16, Math.min(48, Math.round(width / 24)));
    const padding = Math.round(fontSize * 0.65);
    const escaped = this.escapeXml(text);
    return Buffer.from(
      `<svg width="${Math.min(width, Math.max(240, text.length * fontSize))}" height="${fontSize * 2.4}"><style>.w{fill:white;font-family:sans-serif;font-size:${fontSize}px;font-weight:600;paint-order:stroke;stroke:rgba(0,0,0,.42);stroke-width:3px;}</style><text class="w" x="${padding}" y="${fontSize * 1.55}" opacity="${opacity / 100}">${escaped}</text></svg>`,
    );
  }

  private async generateThumbnail(buffer: Buffer): Promise<GeneratedThumbnail> {
    const size = Math.max(
      160,
      Math.min(1600, Number(this.config.get("images.thumbnailSize")) || 480),
    );
    const thumbnail = await sharp(buffer, {
      pages: 1,
      limitInputPixels: this.getMaxInputPixels(),
    })
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
    return {
      data: thumbnail.data,
      width: thumbnail.info.width,
      height: thumbnail.info.height,
    };
  }

  private async createThumbnail(
    imageId: string,
    buffer: Buffer,
    slug: string,
    generated?: GeneratedThumbnail,
  ) {
    const thumbnail = generated ?? (await this.generateThumbnail(buffer));
    const asset = (await this.assets.createFile(
      thumbnail.data,
      { index: 0, total: 1 },
      { name: `${slug}.thumbnail.webp` },
    )) as Asset;
    try {
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { mimeType: "image/webp" },
      });
      return await this.prisma.imageVariant.create({
        data: {
          kind: ImageVariantKind.THUMBNAIL,
          width: thumbnail.width,
          height: thumbnail.height,
          mimeType: "image/webp",
          size: thumbnail.data.length.toString(),
          hostedImage: { connect: { id: imageId } },
          asset: { connect: { id: asset.id } },
        },
        include: { asset: true },
      });
    } catch (error) {
      await this.assets.remove(asset).catch(() => undefined);
      throw error;
    }
  }

  private async getThumbnail(image: HostedImageWithRelations) {
    let thumbnail = image.variants?.find(
      (variant) => variant.kind === ImageVariantKind.THUMBNAIL,
    );
    if (!thumbnail) {
      const original = await this.assets.getDownloadStream(image.asset);
      const buffer = await this.streamToBuffer(
        original.file,
        Number(image.asset.size),
      );
      try {
        thumbnail = await this.createThumbnail(image.id, buffer, image.slug);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await this.prisma.imageVariant.findUnique({
            where: {
              hostedImageId_kind: {
                hostedImageId: image.id,
                kind: ImageVariantKind.THUMBNAIL,
              },
            },
            include: { asset: true },
          });
          if (existing) thumbnail = existing;
          else throw error;
        } else {
          throw error;
        }
      }
    }
    return this.assets.getDownloadStream(thumbnail.asset);
  }

  private async getOwned(
    id: string,
    userId: string,
    includeDeleted = false,
  ): Promise<HostedImageWithRelations> {
    const image = await this.prisma.hostedImage.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
        asset: { ownerId: userId, shareId: null, roomId: null },
      },
      include: IMAGE_INCLUDE,
    });
    if (!image) throw new NotFoundException("Image not found");
    return image as HostedImageWithRelations;
  }

  private async getAdmin(id: string): Promise<HostedImageWithRelations> {
    const image = await this.prisma.hostedImage.findUnique({
      where: { id },
      include: IMAGE_INCLUDE,
    });
    if (!image) throw new NotFoundException("Image not found");
    return image as HostedImageWithRelations;
  }

  private async getPublic(slug: string): Promise<HostedImageWithRelations> {
    const image = await this.prisma.hostedImage.findFirst({
      where: { slug, visibility: ImageVisibility.PUBLIC, deletedAt: null },
      include: IMAGE_INCLUDE,
    });
    if (!image) throw new NotFoundException("Image not found");
    return image as HostedImageWithRelations;
  }

  private async getOwnedBatch(
    ids: string[],
    userId: string,
    includeDeleted = false,
  ) {
    const uniqueIds = [...new Set(ids)];
    if (
      uniqueIds.length === 0 ||
      uniqueIds.length > MAX_HOSTED_IMAGE_BATCH_SIZE
    ) {
      throw new BadRequestException(
        `Select between 1 and ${MAX_HOSTED_IMAGE_BATCH_SIZE} images`,
      );
    }
    const images = await this.prisma.hostedImage.findMany({
      where: {
        id: { in: uniqueIds },
        ...(includeDeleted ? {} : { deletedAt: null }),
        asset: { ownerId: userId, shareId: null, roomId: null },
      },
      include: IMAGE_INCLUDE,
    });
    if (images.length !== uniqueIds.length) {
      throw new NotFoundException("One or more images were not found");
    }
    return images as HostedImageWithRelations[];
  }

  private async getAdminBatch(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (
      uniqueIds.length === 0 ||
      uniqueIds.length > MAX_HOSTED_IMAGE_BATCH_SIZE
    ) {
      throw new BadRequestException(
        `Select between 1 and ${MAX_HOSTED_IMAGE_BATCH_SIZE} images`,
      );
    }
    const images = await this.prisma.hostedImage.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      include: IMAGE_INCLUDE,
    });
    if (images.length !== uniqueIds.length) {
      throw new NotFoundException("One or more images were not found");
    }
    return images as HostedImageWithRelations[];
  }

  private async getOwnedAlbum(id: string, userId: string) {
    const album = await this.prisma.imageAlbum.findFirst({
      where: { id, ownerId: userId },
    });
    if (!album) throw new NotFoundException("Album not found");
    return album;
  }

  private async destroyImage(image: HostedImageWithRelations) {
    for (const variant of image.variants ?? []) {
      await this.assets.remove(variant.asset);
    }
    await this.assets.remove(image.asset);
  }

  private async createAvailableSlug() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const slug = createSlug();
      const existing = await this.prisma.hostedImage.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    throw new BadRequestException("Could not generate an image URL");
  }

  private async assertUploadRate(userId: string) {
    const limit = Math.max(
      1,
      Number(this.config.get("images.uploadsPerMinute")) || 30,
    );
    const uploads = await this.prisma.hostedImage.count({
      where: {
        asset: { ownerId: userId },
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (uploads >= limit) {
      throw new ServiceUnavailableException(
        "Image upload rate limit reached. Try again in a minute",
      );
    }
  }

  private async assertQuota(userId: string, incomingBytes: number) {
    const quota = Number(this.config.get("images.userQuota")) || 0;
    if (quota <= 0) return;
    const stats = await this.stats(userId);
    if (stats.totalSize + incomingBytes > quota) {
      throw new ForbiddenException("Image storage quota exceeded");
    }
  }

  private assertUploadEnabled() {
    if (!this.config.get("images.uploadEnabled")) {
      throw new ServiceUnavailableException(
        "Image uploads are disabled by the administrator",
      );
    }
  }

  private resolveVisibility(visibility?: ImageVisibility) {
    const resolved =
      visibility ??
      (this.config.get("images.allowPublic") &&
      this.config.get("images.defaultPublic")
        ? ImageVisibility.PUBLIC
        : ImageVisibility.PRIVATE);
    this.assertVisibilityAllowed(resolved);
    return resolved;
  }

  private assertVisibilityAllowed(visibility: ImageVisibility) {
    if (
      visibility === ImageVisibility.PUBLIC &&
      !this.config.get("images.allowPublic")
    ) {
      throw new ForbiddenException(
        "Public image links are disabled by the administrator",
      );
    }
  }

  private getMaxInputPixels() {
    return Math.max(
      1_000_000,
      Math.min(
        250_000_000,
        Number(this.config.get("images.maxPixels")) || 40_000_000,
      ),
    );
  }

  private getPublicOrigin(requestOrigin: string) {
    const configured = `${this.config.get("images.publicBaseUrl") ?? ""}`
      .trim()
      .replace(/\/+$/, "");
    return configured || requestOrigin;
  }

  private normalizeStats(row?: {
    count?: number | bigint | null;
    publicCount?: number | bigint | null;
    privateCount?: number | bigint | null;
    totalSize?: number | bigint | null;
    views?: number | bigint | null;
  }): HostedImageStats {
    return {
      count: Number(row?.count ?? 0),
      publicCount: Number(row?.publicCount ?? 0),
      privateCount: Number(row?.privateCount ?? 0),
      totalSize: Number(row?.totalSize ?? 0),
      views: Number(row?.views ?? 0),
    };
  }

  private recordView(id: string) {
    void this.prisma.hostedImage
      .update({
        where: { id },
        data: { views: { increment: 1 }, lastViewedAt: new Date() },
      })
      .catch(() => undefined);
  }

  private async readImageMetadata(buffer: Buffer) {
    try {
      return await sharp(buffer, {
        animated: true,
        limitInputPixels: this.getMaxInputPixels(),
      }).metadata();
    } catch {
      throw new BadRequestException("The uploaded file is not a valid image");
    }
  }

  private getMimeType(format?: string, uploadedMimeType?: string) {
    const detected = format ? FORMAT_MIME_TYPES[format] : undefined;
    if (!detected) return undefined;
    if (detected === "image/avif" && uploadedMimeType !== "image/avif") {
      return undefined;
    }
    return detected;
  }

  private normalizeFileName(originalName: string, mimeType: string) {
    const baseName = path.basename(originalName || "image").slice(0, 255);
    const extension = OUTPUT_EXTENSIONS[mimeType] ?? ".img";
    const currentExtension = path.extname(baseName);
    const stem = currentExtension
      ? baseName.slice(0, -currentExtension.length)
      : baseName;
    return `${stem || "image"}${extension}`.slice(0, 255);
  }

  private async streamToBuffer(stream: Readable, expectedSize = 0) {
    if (expectedSize > MAX_HOSTED_IMAGE_HARD_BYTES) {
      throw new BadRequestException("Image is too large to process");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_HOSTED_IMAGE_HARD_BYTES) {
        stream.destroy();
        throw new BadRequestException("Image is too large to process");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  private formatBytes(bytes: number) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  private escapeXml(value: string) {
    return this.escapeHtml(value);
  }
}
