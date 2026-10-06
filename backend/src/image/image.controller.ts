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
import { validate as isValidUUID } from "uuid";
import { AppCredentialGuard } from "src/appCredential/appCredential.guard";
import {
  AppCredentialScope,
  RequireAppCredentialScopes,
} from "src/appCredential/appCredential.types";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import {
  AdminBatchUpdateHostedImageDTO,
  BatchHostedImageDTO,
  BatchUpdateHostedImageDTO,
} from "./dto/batchHostedImage.dto";
import { CreateImageAlbumDTO, UpdateImageAlbumDTO } from "./dto/imageAlbum.dto";
import { UpdateImagePreferenceDTO } from "./dto/imagePreference.dto";
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import { ImageService } from "./image.service";
import {
  HOSTED_IMAGE_MIME_TYPES,
  HOSTED_IMAGE_SORTS,
  HostedImageSort,
  ListHostedImageQuery,
  MAX_HOSTED_IMAGE_HARD_BYTES,
} from "./image.types";

type RawListHostedImageQuery = {
  q?: string;
  visibility?: string;
  albumId?: string;
  tag?: string;
  favorite?: string;
  trashed?: string;
  cursor?: string;
  limit?: string;
  sort?: string;
  ownerId?: string;
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
): {
  file: Express.Multer.File | undefined;
  visibility?: ImageVisibility;
  albumId?: string;
} => {
  const body = request.body;
  const bodyValue = (key: string) =>
    body && !Buffer.isBuffer(body) && typeof body === "object"
      ? firstValue((body as Record<string, unknown>)[key])
      : undefined;
  const visibilityValue =
    bodyValue("visibility") ??
    firstValue(request.query.visibility) ??
    firstValue(request.headers["x-image-visibility"]);
  const albumId =
    bodyValue("albumId") ??
    firstValue(request.query.albumId) ??
    firstValue(request.headers["x-image-album"]);

  if (
    visibilityValue &&
    !Object.values(ImageVisibility).includes(visibilityValue as ImageVisibility)
  ) {
    throw new BadRequestException("Image visibility must be PUBLIC or PRIVATE");
  }
  if (albumId && !isValidUUID(albumId)) {
    throw new BadRequestException("Image album id is invalid");
  }

  if (multipartFile || !Buffer.isBuffer(body) || body.length === 0) {
    return {
      file: multipartFile,
      visibility: visibilityValue as ImageVisibility | undefined,
      albumId,
    };
  }

  const mimeType = `${request.headers["content-type"] ?? ""}`
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    !HOSTED_IMAGE_MIME_TYPES.includes(
      mimeType as (typeof HOSTED_IMAGE_MIME_TYPES)[number],
    )
  ) {
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
    albumId,
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

const parseListQuery = (query: RawListHostedImageQuery) => {
  const result: ListHostedImageQuery = {};
  if (query.q) result.q = query.q.trim();
  if (query.tag) result.tag = query.tag.trim();
  if (query.visibility && query.visibility in ImageVisibility) {
    result.visibility = query.visibility as ImageVisibility;
  }
  if (query.albumId) {
    if (!isValidUUID(query.albumId)) {
      throw new BadRequestException("Image album id is invalid");
    }
    result.albumId = query.albumId;
  }
  if (query.cursor) {
    if (!isValidUUID(query.cursor)) {
      throw new BadRequestException("Image cursor is invalid");
    }
    result.cursor = query.cursor;
  }
  if (query.favorite === "true") result.favorite = true;
  else if (query.favorite === "false") result.favorite = false;
  result.trashed = query.trashed === "true";
  if (query.limit) {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new BadRequestException("Image page size is invalid");
    }
    result.limit = limit;
  }
  if (
    query.sort &&
    HOSTED_IMAGE_SORTS.includes(query.sort as HostedImageSort)
  ) {
    result.sort = query.sort as HostedImageSort;
  }
  return result;
};

@Controller("images/public")
export class PublicImageController {
  constructor(private readonly images: ImageService) {}

  @Get(":slug/thumbnail")
  async thumbnail(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getPublicThumbnail(slug);
    setImageHeaders(
      response,
      image.metaData,
      this.images.getPublicCacheControl(),
    );
    return new StreamableFile(image.file);
  }

  @Get(":slug")
  async content(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getPublicContent(slug);
    setImageHeaders(
      response,
      image.metaData,
      this.images.getPublicCacheControl(),
    );
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
    const page = await this.images.list(user.id, parseListQuery(query));
    const origin = getOrigin(request);
    return {
      ...page,
      items: page.items.map((image) => this.images.toResponse(image, origin)),
    };
  }

  @Get("stats")
  async stats(@GetUser() user: User) {
    return this.images.stats(user.id);
  }

  @Get("preferences")
  async preferences(@GetUser() user: User) {
    return this.images.getPreference(user.id);
  }

  @Patch("preferences")
  async updatePreferences(
    @GetUser() user: User,
    @Body() input: UpdateImagePreferenceDTO,
  ) {
    return this.images.updatePreference(user.id, input);
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
      upload.albumId,
    );
    return this.images.toResponse(image, getOrigin(request));
  }

  @Patch("batch")
  async updateBatch(
    @Body() input: BatchUpdateHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const images = await this.images.updateBatch(input.ids, user.id, {
      visibility: input.visibility,
      albumId: input.albumId,
    });
    const origin = getOrigin(request);
    return images.map((image) => this.images.toResponse(image, origin));
  }

  @Delete("batch")
  async removeBatch(@Body() input: BatchHostedImageDTO, @GetUser() user: User) {
    return { deleted: await this.images.removeBatch(input.ids, user.id) };
  }

  @Post("batch/restore")
  async restoreBatch(
    @Body() input: BatchHostedImageDTO,
    @GetUser() user: User,
  ) {
    return { restored: await this.images.restoreBatch(input.ids, user.id) };
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

  @Get(":id/original")
  async original(
    @Param("id") id: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getOriginalContent(id, user.id);
    setImageHeaders(response, image.metaData, "private, no-store");
    return new StreamableFile(image.file);
  }

  @Get(":id/thumbnail")
  async thumbnail(
    @Param("id") id: string,
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getOwnedThumbnail(id, user.id);
    setImageHeaders(response, image.metaData, "private, max-age=3600");
    return new StreamableFile(image.file);
  }

  @Post(":id/restore")
  async restore(
    @Param("id") id: string,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    return this.images.toResponse(
      await this.images.restore(id, user.id),
      getOrigin(request),
    );
  }

  @Delete(":id/permanent")
  async destroy(@Param("id") id: string, @GetUser() user: User) {
    await this.images.destroy(id, user.id);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @GetUser() user: User) {
    await this.images.remove(id, user.id);
  }
}

@Controller("image-albums")
@UseGuards(AuthGuard("jwt"))
export class ImageAlbumController {
  constructor(private readonly images: ImageService) {}

  @Get()
  list(@GetUser() user: User) {
    return this.images.listAlbums(user.id);
  }

  @Post()
  create(@GetUser() user: User, @Body() input: CreateImageAlbumDTO) {
    return this.images.createAlbum(user.id, input);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @GetUser() user: User,
    @Body() input: UpdateImageAlbumDTO,
  ) {
    return this.images.updateAlbum(id, user.id, input);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @GetUser() user: User) {
    return this.images.removeAlbum(id, user.id);
  }
}

@Controller("admin/images")
@UseGuards(JwtGuard, AdministratorGuard)
export class AdminImageController {
  constructor(private readonly images: ImageService) {}

  @Get()
  async list(@Query() query: RawListHostedImageQuery, @Req() request: Request) {
    const page = await this.images.listAdmin({
      ...parseListQuery(query),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    });
    const origin = getOrigin(request);
    return {
      ...page,
      items: page.items.map((image) =>
        this.images.toResponse(image, origin, { admin: true }),
      ),
    };
  }

  @Get("stats")
  stats() {
    return this.images.adminStats();
  }

  @Patch("batch")
  async updateBatch(@Body() input: AdminBatchUpdateHostedImageDTO) {
    return {
      updated: await this.images.updateBatchAdmin(input.ids, input.visibility),
    };
  }

  @Delete("batch")
  async removeBatch(@Body() input: BatchHostedImageDTO) {
    return { deleted: await this.images.destroyBatchAdmin(input.ids) };
  }

  @Get(":id/thumbnail")
  async thumbnail(
    @Param("id") id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const image = await this.images.getAdminThumbnail(id);
    setImageHeaders(response, image.metaData, "private, no-store");
    return new StreamableFile(image.file);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.images.destroyAdmin(id);
  }
}

@Controller("image-api/images")
@UseGuards(AppCredentialGuard)
export class ImageApiController {
  constructor(private readonly images: ImageService) {}

  @Get()
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_READ)
  async list(
    @Query() query: RawListHostedImageQuery,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const page = await this.images.list(user.id, parseListQuery(query));
    const origin = getOrigin(request);
    return {
      ...page,
      items: page.items.map((image) => this.images.toResponse(image, origin)),
    };
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
      upload.albumId,
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
    const images = await this.images.updateBatch(input.ids, user.id, {
      visibility: input.visibility,
      albumId: input.albumId,
    });
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
