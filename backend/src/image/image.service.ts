import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Asset, HostedImage, ImageVisibility, User } from "@prisma/client";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import * as path from "path";
import * as sharp from "sharp";
import { AssetService } from "src/asset/asset.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import {
  HOSTED_IMAGE_MIME_TYPES,
  ListHostedImageQuery,
  DEFAULT_MAX_HOSTED_IMAGE_BYTES,
  HostedImageStats,
  MAX_HOSTED_IMAGE_BATCH_SIZE,
  MAX_HOSTED_IMAGE_HARD_BYTES,
} from "./image.types";

type HostedImageWithAsset = HostedImage & { asset: Asset };

const createSlug = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  12,
);

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

@Injectable()
export class ImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    user: User,
    visibility?: ImageVisibility,
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

    const resolvedVisibility = this.resolveVisibility(visibility);

    const metadata = await this.readImageMetadata(file.buffer);
    const mimeType = this.getMimeType(metadata.format, file.mimetype);
    if (!mimeType || !metadata.width || !metadata.height) {
      throw new BadRequestException(
        "Only JPEG, PNG, WebP, GIF and AVIF images are supported",
      );
    }

    const name = this.normalizeFileName(file.originalname, mimeType);
    const asset = (await this.assets.createFile(
      file.buffer,
      { index: 0, total: 1 },
      { name },
      user,
    )) as Asset;

    try {
      const slug = await this.createAvailableSlug();
      const hostedImage = await this.prisma.hostedImage.create({
        data: {
          slug,
          visibility: resolvedVisibility,
          width: metadata.width,
          height: metadata.height,
          checksum: crypto
            .createHash("sha256")
            .update(file.buffer)
            .digest("hex"),
          asset: {
            connect: { id: asset.id },
          },
        },
        include: { asset: true },
      });

      if (asset.mimeType !== mimeType || asset.name !== name) {
        hostedImage.asset = await this.prisma.asset.update({
          where: { id: asset.id },
          data: { mimeType, name },
        });
      }

      return hostedImage;
    } catch (error) {
      await this.assets.removeOwned(asset.id, user.id).catch(() => undefined);
      throw error;
    }
  }

  async list(userId: string, query: ListHostedImageQuery = {}) {
    return this.prisma.hostedImage.findMany({
      where: {
        asset: { ownerId: userId, shareId: null, roomId: null },
        ...(query.visibility ? { visibility: query.visibility } : {}),
        ...(query.q
          ? {
              OR: [
                { slug: { contains: query.q } },
                { asset: { name: { contains: query.q } } },
              ],
            }
          : {}),
      },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async stats(userId: string): Promise<HostedImageStats> {
    const images = await this.prisma.hostedImage.findMany({
      where: { asset: { ownerId: userId } },
      select: {
        visibility: true,
        asset: { select: { size: true } },
      },
    });

    return images.reduce<HostedImageStats>(
      (stats, image) => ({
        count: stats.count + 1,
        publicCount:
          stats.publicCount +
          (image.visibility === ImageVisibility.PUBLIC ? 1 : 0),
        privateCount:
          stats.privateCount +
          (image.visibility === ImageVisibility.PRIVATE ? 1 : 0),
        totalSize: stats.totalSize + (Number(image.asset.size) || 0),
      }),
      { count: 0, publicCount: 0, privateCount: 0, totalSize: 0 },
    );
  }

  async update(id: string, userId: string, input: UpdateHostedImageDTO) {
    const image = await this.getOwned(id, userId);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException("Image name is required");
    }
    if (input.visibility) this.assertVisibilityAllowed(input.visibility);

    return this.prisma.hostedImage.update({
      where: { id: image.id },
      data: {
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(name ? { asset: { update: { name } } } : {}),
      },
      include: { asset: true },
    });
  }

  async updateBatch(
    ids: string[],
    userId: string,
    visibility: ImageVisibility,
  ) {
    const images = await this.getOwnedBatch(ids, userId);
    this.assertVisibilityAllowed(visibility);

    return Promise.all(
      images.map((image) =>
        this.prisma.hostedImage.update({
          where: { id: image.id },
          data: { visibility },
          include: { asset: true },
        }),
      ),
    );
  }

  async remove(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    await this.assets.removeOwned(image.assetId, userId);
  }

  async removeBatch(ids: string[], userId: string) {
    const images = await this.getOwnedBatch(ids, userId);
    for (const image of images) {
      await this.assets.removeOwned(image.assetId, userId);
    }
    return images.length;
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

  async getOwnedContent(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    return this.assets.getDownloadStream(image.asset);
  }

  async getPublicContent(slug: string) {
    const image = await this.prisma.hostedImage.findFirst({
      where: { slug, visibility: ImageVisibility.PUBLIC },
      include: { asset: true },
    });
    if (!image) throw new NotFoundException("Image not found");
    return this.assets.getDownloadStream(image.asset);
  }

  toResponse(image: HostedImageWithAsset, origin: string) {
    const path = `/i/${image.slug}`;
    const url =
      image.visibility === ImageVisibility.PUBLIC ? `${origin}${path}` : null;

    return {
      id: image.id,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      slug: image.slug,
      visibility: image.visibility,
      width: image.width,
      height: image.height,
      checksum: image.checksum,
      name: image.asset.name,
      size: image.asset.size,
      mimeType: image.asset.mimeType,
      url,
      path: url ? path : null,
      contentUrl: `/api/images/${image.id}/content`,
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
    };
  }

  private async getOwned(
    id: string,
    userId: string,
  ): Promise<HostedImageWithAsset> {
    const image = await this.prisma.hostedImage.findFirst({
      where: {
        id,
        asset: { ownerId: userId, shareId: null, roomId: null },
      },
      include: { asset: true },
    });
    if (!image) throw new NotFoundException("Image not found");
    return image;
  }

  private async getOwnedBatch(ids: string[], userId: string) {
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
        asset: { ownerId: userId, shareId: null, roomId: null },
      },
      include: { asset: true },
    });
    if (images.length !== uniqueIds.length) {
      throw new NotFoundException("One or more images were not found");
    }
    return images;
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

  private formatBytes(bytes: number) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }

  private async readImageMetadata(buffer: Buffer) {
    try {
      return await sharp(buffer, {
        animated: true,
        limitInputPixels: true,
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
    const fallbackExtensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/avif": ".avif",
    };
    const baseName = path.basename(originalName || "image").slice(0, 255);
    return path.extname(baseName)
      ? baseName
      : `${baseName}${fallbackExtensions[mimeType]}`;
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
}
