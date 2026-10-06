import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "@nestjs/passport";
import { ImageVisibility, User } from "@prisma/client";
import * as contentDisposition from "content-disposition";
import { Request, Response } from "express";
import {
  AppCredentialScope,
  RequireAppCredentialScopes,
} from "src/appCredential/appCredential.types";
import { AppCredentialGuard } from "src/appCredential/appCredential.guard";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import {
  BatchHostedImageDTO,
  BatchUpdateHostedImageDTO,
} from "./dto/batchHostedImage.dto";
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import { ImageService } from "./image.service";
import {
  HOSTED_IMAGE_MIME_TYPES,
  ListHostedImageQuery,
  MAX_HOSTED_IMAGE_HARD_BYTES,
} from "./image.types";

type RawListHostedImageQuery = {
  q?: string;
  visibility?: string;
};

const uploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: MAX_HOSTED_IMAGE_HARD_BYTES, files: 1 },
});

const RAW_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const firstValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return firstValue(value[0]);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const decodeFileName = (value: string | undefined) => {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const parseHostedImageUpload = (
  multipartFile: Express.Multer.File | undefined,
  request: Request,
): { file: Express.Multer.File | undefined; visibility?: ImageVisibility } => {
  const body = request.body;
  const bodyVisibility =
    body && !Buffer.isBuffer(body) && typeof body === "object"
      ? firstValue((body as Record<string, unknown>).visibility)
      : undefined;
  const visibilityValue =
    bodyVisibility ??
    firstValue(request.query.visibility) ??
    firstValue(request.headers["x-image-visibility"]);

  if (
    visibilityValue &&
    !Object.values(ImageVisibility).includes(visibilityValue as ImageVisibility)
  ) {
    throw new BadRequestException("Image visibility must be PUBLIC or PRIVATE");
  }

  if (multipartFile || !Buffer.isBuffer(body) || body.length === 0) {
    return {
      file: multipartFile,
      visibility: visibilityValue as ImageVisibility | undefined,
    };
  }

  const mimeType = `${request.headers["content-type"] ?? ""}`
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!HOSTED_IMAGE_MIME_TYPES.includes(mimeType as any)) {
    throw new BadRequestException("Unsupported image content type");
  }

  const providedName = decodeFileName(
    firstValue(request.headers["x-file-name"]),
  );
  const extension = RAW_IMAGE_EXTENSIONS[mimeType] ?? "img";

  return {
    file: {
      buffer: body,
      size: body.length,
      originalname: providedName ?? `image-${Date.now()}.${extension}`,
      mimetype: mimeType,
    } as Express.Multer.File,
    visibility: visibilityValue as ImageVisibility | undefined,
  };
};

const getOrigin = (request: Request) =>
  `${request.protocol}://${request.get("host")}`;

const setImageHeaders = (
  response: Response,
  metadata: { mimeType: string; size: string; name: string },
  cacheControl: string,
) => {
  response.set({
    "Content-Type": metadata.mimeType,
    "Content-Length": metadata.size,
    "Content-Disposition": contentDisposition(metadata.name, {
      type: "inline",
    }),
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });
};

@Controller("images/public")
export class PublicImageController {
  constructor(private readonly images: ImageService) {}

  @Get(":slug")
  async content(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getPublicContent(slug);
    setImageHeaders(response, image.metaData, "public, max-age=300");
    return new StreamableFile(image.file);
  }
}

@Controller("images")
@UseGuards(AuthGuard("jwt"))
export class ImageController {
  constructor(private readonly images: ImageService) {}

  @Get()
  async list(
    @Query() query: RawListHostedImageQuery,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const images = await this.images.list(user.id, this.parseQuery(query));
    const origin = getOrigin(request);
    return images.map((image) => this.images.toResponse(image, origin));
  }

  @Get("stats")
  async stats(@GetUser() user: User) {
    return this.images.stats(user.id);
  }

  @Post()
  @UseInterceptors(uploadInterceptor)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const upload = parseHostedImageUpload(file, request);
    const image = await this.images.upload(
      upload.file,
      user,
      upload.visibility,
    );
    return this.images.toResponse(image, getOrigin(request));
  }

  @Patch("batch")
  async updateBatch(
    @Body() input: BatchUpdateHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const images = await this.images.updateBatch(
      input.ids,
      user.id,
      input.visibility,
    );
    const origin = getOrigin(request);
    return images.map((image) => this.images.toResponse(image, origin));
  }

  @Delete("batch")
  async removeBatch(@Body() input: BatchHostedImageDTO, @GetUser() user: User) {
    return { deleted: await this.images.removeBatch(input.ids, user.id) };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() input: UpdateHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const image = await this.images.update(id, user.id, input);
    return this.images.toResponse(image, getOrigin(request));
  }

  @Get(":id/content")
  async content(
    @Param("id") id: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getOwnedContent(id, user.id);
    setImageHeaders(response, image.metaData, "private, no-store");
    return new StreamableFile(image.file);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @GetUser() user: User) {
    await this.images.remove(id, user.id);
  }

  private parseQuery(query: RawListHostedImageQuery): ListHostedImageQuery {
    return {
      ...(query.q ? { q: query.q.trim() } : {}),
      ...(query.visibility && query.visibility in ImageVisibility
        ? { visibility: query.visibility as ImageVisibility }
        : {}),
    };
  }
}

@Controller("image-api/images")
@UseGuards(AppCredentialGuard)
export class ImageApiController {
  constructor(private readonly images: ImageService) {}

  @Get()
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_READ)
  async list(@GetUser() user: User, @Req() request: Request) {
    const images = await this.images.list(user.id);
    const origin = getOrigin(request);
    return images.map((image) => this.images.toResponse(image, origin));
  }

  @Get("stats")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_READ)
  async stats(@GetUser() user: User) {
    return this.images.stats(user.id);
  }

  @Post()
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  @UseInterceptors(uploadInterceptor)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    this.images.assertApiUploadEnabled();
    const upload = parseHostedImageUpload(file, request);
    const image = await this.images.upload(
      upload.file,
      user,
      upload.visibility,
    );
    return this.images.toResponse(image, getOrigin(request));
  }

  @Patch("batch")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  async updateBatch(
    @Body() input: BatchUpdateHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const images = await this.images.updateBatch(
      input.ids,
      user.id,
      input.visibility,
    );
    const origin = getOrigin(request);
    return images.map((image) => this.images.toResponse(image, origin));
  }

  @Delete("batch")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  async removeBatch(@Body() input: BatchHostedImageDTO, @GetUser() user: User) {
    return { deleted: await this.images.removeBatch(input.ids, user.id) };
  }

  @Patch(":id")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  async update(
    @Param("id") id: string,
    @Body() input: UpdateHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const image = await this.images.update(id, user.id, input);
    return this.images.toResponse(image, getOrigin(request));
  }

  @Get(":id/content")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_READ)
  async content(
    @Param("id") id: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getOwnedContent(id, user.id);
    setImageHeaders(response, image.metaData, "private, no-store");
    return new StreamableFile(image.file);
  }

  @Delete(":id")
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  async remove(@Param("id") id: string, @GetUser() user: User) {
    await this.images.remove(id, user.id);
  }
}
