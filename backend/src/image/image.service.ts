import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Asset, HostedImage, ImageVisibility, User } from "@prisma/client";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import * as path from "path";
import * as sharp from "sharp";
import { AssetService } from "src/asset/asset.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import {
  HOSTED_IMAGE_MIME_TYPES,
  ListHostedImageQuery,
  MAX_HOSTED_IMAGE_BYTES,
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
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    user: User,
    visibility: ImageVisibility = ImageVisibility.PUBLIC,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("An image file is required");
    }
    if (file.size > MAX_HOSTED_IMAGE_BYTES) {
      throw new BadRequestException("Image must be 25 MB or smaller");
    }

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
          visibility,
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

  async update(id: string, userId: string, input: UpdateHostedImageDTO) {
    const image = await this.getOwned(id, userId);
    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException("Image name is required");
    }

    return this.prisma.hostedImage.update({
      where: { id: image.id },
      data: {
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(name ? { asset: { update: { name } } } : {}),
      },
      include: { asset: true },
    });
  }

  async remove(id: string, userId: string) {
    const image = await this.getOwned(id, userId);
    await this.assets.removeOwned(image.assetId, userId);
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
