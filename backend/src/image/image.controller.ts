import {
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
import { UpdateHostedImageDTO } from "./dto/updateHostedImage.dto";
import { UploadHostedImageDTO } from "./dto/uploadHostedImage.dto";
import { ImageService } from "./image.service";
import { ListHostedImageQuery, MAX_HOSTED_IMAGE_BYTES } from "./image.types";

type RawListHostedImageQuery = {
  q?: string;
  visibility?: string;
};

const uploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: MAX_HOSTED_IMAGE_BYTES, files: 1 },
});

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

  @Post()
  @UseInterceptors(uploadInterceptor)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() input: UploadHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const image = await this.images.upload(file, user, input.visibility);
    return this.images.toResponse(image, getOrigin(request));
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

  @Post()
  @RequireAppCredentialScopes(AppCredentialScope.IMAGE_WRITE)
  @UseInterceptors(uploadInterceptor)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() input: UploadHostedImageDTO,
    @GetUser() user: User,
    @Req() request: Request,
  ) {
    const image = await this.images.upload(file, user, input.visibility);
    return this.images.toResponse(image, getOrigin(request));
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
