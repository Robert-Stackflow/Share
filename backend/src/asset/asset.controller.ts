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
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import * as contentDisposition from "content-disposition";
import { Response } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { AssetSource, AssetType, User } from "@prisma/client";
import { AssetService } from "./asset.service";
import { CreateAssetDTO, CreateAssetType } from "./dto/createAsset.dto";

type AssetSortOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "lastAccessedAt_desc"
  | "name_asc";

const ASSET_SORT_OPTIONS: AssetSortOption[] = [
  "createdAt_desc",
  "createdAt_asc",
  "lastAccessedAt_desc",
  "name_asc",
];

type ListAssetQuery = {
  q?: string;
  type?: string;
  source?: string;
  favorite?: string;
  tag?: string;
  sort?: string;
};

type CreateAssetQuery = {
  type?: string;
  id?: string;
  name?: string;
  chunkIndex?: string;
  totalChunks?: string;
};

type UpdateAssetBody = {
  content?: string;
  url?: string;
  name?: string;
  favorite?: boolean;
  tags?: string[];
};

type SendToRoomBody = {
  roomId?: string;
};

@Controller("assets")
@UseGuards(AuthGuard("jwt"))
export class AssetController {
  constructor(private assetService: AssetService) {}

  @Post()
  async create(
    @Query() query: CreateAssetQuery,
    @Body() body: CreateAssetDTO | string,
    @GetUser() user: User,
  ) {
    if (query.type === CreateAssetType.FILE) {
      if (!query.name || !query.chunkIndex || !query.totalChunks) {
        throw new BadRequestException("File asset upload metadata is required");
      }

      return this.assetService.createFile(
        body as string,
        {
          index: parseInt(query.chunkIndex),
          total: parseInt(query.totalChunks),
        },
        { id: query.id, name: query.name },
        user,
      );
    }

    body = body as CreateAssetDTO;
    if (body.type === CreateAssetType.TEXT) {
      return this.assetService.createText({ content: body.content }, user);
    }

    if (body.type === CreateAssetType.LINK) {
      return this.assetService.createLink({ url: body.url }, user);
    }

    throw new BadRequestException("Unsupported asset type");
  }

  @Get()
  async list(@Query() query: ListAssetQuery, @GetUser() user: User) {
    const filters: {
      q?: string;
      type?: AssetType;
      source?: AssetSource;
      favorite?: boolean;
      tag?: string;
      sort?: AssetSortOption;
    } = {};

    if (query.q) filters.q = query.q;
    if (query.tag) filters.tag = query.tag;
    if (query.type && query.type in AssetType) {
      filters.type = query.type as AssetType;
    }
    if (query.source && query.source in AssetSource) {
      filters.source = query.source as AssetSource;
    }
    if (query.favorite === "true") filters.favorite = true;
    else if (query.favorite === "false") filters.favorite = false;
    if (
      query.sort &&
      ASSET_SORT_OPTIONS.includes(query.sort as AssetSortOption)
    ) {
      filters.sort = query.sort as AssetSortOption;
    }

    return this.assetService.listByOwner(user.id, filters);
  }

  @Get("tags")
  async listTags(@GetUser() user: User) {
    return this.assetService.listTags(user.id);
  }

  @Get(":id")
  async get(@Param("id") id: string, @GetUser() user: User) {
    return this.assetService.getOwned(id, user.id);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateAssetBody,
    @GetUser() user: User,
  ) {
    return this.assetService.updateOwned(id, user.id, body);
  }

  @Post(":id/clone")
  async clone(@Param("id") id: string, @GetUser() user: User) {
    return this.assetService.cloneOwned(id, user);
  }

  @Post(":id/share")
  async share(@Param("id") id: string, @GetUser() user: User) {
    return this.assetService.createShareFromAsset(id, user);
  }

  @Post(":id/short-link")
  async shortLink(@Param("id") id: string, @GetUser() user: User) {
    return this.assetService.createShortLinkFromAsset(id, user);
  }

  @Post(":id/send-to-room")
  async sendToRoom(
    @Param("id") id: string,
    @Body() body: SendToRoomBody,
    @GetUser() user: User,
  ) {
    if (!body.roomId) {
      throw new BadRequestException("Room id is required");
    }
    return this.assetService.sendToRoom(id, body.roomId, user);
  }

  @Get(":id/download")
  async download(
    @Res({ passthrough: true }) res: Response,
    @Param("id") id: string,
    @GetUser() user: User,
  ) {
    const file = await this.assetService.getOwnedDownloadStream(id, user.id);

    res.set({
      "Content-Type": file.metaData.mimeType,
      "Content-Length": file.metaData.size,
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": contentDisposition(file.metaData.name),
    });

    return new StreamableFile(file.file);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @GetUser() user: User) {
    await this.assetService.removeOwned(id, user.id);
  }
}
