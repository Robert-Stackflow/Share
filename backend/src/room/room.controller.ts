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
  Sse,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { User } from "@prisma/client";
import * as contentDisposition from "content-disposition";
import { Request, Response } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { OptionalJwtGuard } from "./room.guard";
import { RoomService } from "./room.service";
import { CreateRoomDTO, UpdateRoomDTO, VerifyRoomDTO } from "./room.dto";

type AssetQuery = {
  type?: string;
  id?: string;
  name?: string;
  chunkIndex?: string;
  totalChunks?: string;
};

@Controller("rooms")
export class RoomController {
  constructor(private rooms: RoomService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  list(@GetUser() user: User) {
    return this.rooms.listOwned(user.id);
  }

  @Sse("events")
  @UseGuards(AuthGuard("jwt"))
  listEvents(@GetUser() user: User) {
    return this.rooms.ownerListEvents(user.id);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() body: CreateRoomDTO, @GetUser() user: User) {
    return this.rooms.create(body, user);
  }

  @Get(":roomId/owner")
  @UseGuards(AuthGuard("jwt"))
  getOwned(@Param("roomId") roomId: string, @GetUser() user: User) {
    return this.rooms.getOwned(roomId, user.id);
  }

  @Sse(":roomId/owner/events")
  @UseGuards(AuthGuard("jwt"))
  async ownerEvents(@Param("roomId") roomId: string, @GetUser() user: User) {
    await this.rooms.getOwned(roomId, user.id);
    return this.rooms.roomEvents(roomId);
  }

  @Patch(":roomId")
  @UseGuards(AuthGuard("jwt"))
  update(
    @Param("roomId") roomId: string,
    @Body() body: UpdateRoomDTO,
    @GetUser() user: User,
  ) {
    return this.rooms.update(roomId, body, user);
  }

  @Delete(":roomId")
  @UseGuards(AuthGuard("jwt"))
  remove(@Param("roomId") roomId: string, @GetUser() user: User) {
    return this.rooms.remove(roomId, user);
  }

  @Get(":roomId")
  @UseGuards(OptionalJwtGuard)
  async open(
    @Param("roomId") roomId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @GetUser() user?: User,
  ) {
    const result = await this.rooms.open(
      roomId,
      this.token(request, roomId),
      user?.id,
    );
    if (result.token) this.setToken(response, roomId, result.token);
    return result.room;
  }

  @Post(":roomId/verify")
  @UseGuards(OptionalJwtGuard)
  async verify(
    @Param("roomId") roomId: string,
    @Body() body: VerifyRoomDTO,
    @Res({ passthrough: true }) response: Response,
    @GetUser() user?: User,
  ) {
    const token = await this.rooms.verifyPasscode(
      roomId,
      body.passcode,
      user?.id,
    );
    this.setToken(response, roomId, token);
    return { valid: true };
  }

  @Sse(":roomId/events")
  @UseGuards(OptionalJwtGuard)
  async events(
    @Param("roomId") roomId: string,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    await this.rooms.getForRead(roomId, this.token(request, roomId), user?.id);
    return this.rooms.roomEvents(roomId);
  }

  @Post(":roomId/assets")
  @UseGuards(AuthGuard("jwt"))
  addAsset(
    @Param("roomId") roomId: string,
    @Query() query: AssetQuery,
    @Body()
    body: { type: "TEXT" | "LINK"; content?: string; url?: string } | string,
    @Req() request: Request,
    @GetUser() user: User,
  ) {
    if (query.type === "FILE") {
      if (!query.name || query.chunkIndex === undefined || !query.totalChunks) {
        throw new BadRequestException("File asset upload metadata is required");
      }
      return this.rooms.addFile(
        roomId,
        body as string,
        { index: Number(query.chunkIndex), total: Number(query.totalChunks) },
        { id: query.id, name: query.name },
        user,
        this.token(request, roomId),
      );
    }
    return this.rooms.addAsset(
      roomId,
      body as { type: "TEXT" | "LINK"; content?: string; url?: string },
      user,
      this.token(request, roomId),
    );
  }

  @Get(":roomId/assets/:assetId/download")
  @UseGuards(OptionalJwtGuard)
  async download(
    @Param("roomId") roomId: string,
    @Param("assetId") assetId: string,
    @Query("preview") preview: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @GetUser() user?: User,
  ) {
    const previewOnly = preview === "1";
    const file = await this.rooms.getFileDownload(
      roomId,
      assetId,
      this.token(request, roomId),
      user?.id,
      previewOnly,
    );
    response.set({
      "Content-Type": file.metaData.mimeType,
      "Content-Length": file.metaData.size,
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(file.metaData.name, {
        type: previewOnly ? "inline" : "attachment",
      }),
    });
    return new StreamableFile(file.file);
  }

  @Delete(":roomId/assets/:assetId")
  @UseGuards(AuthGuard("jwt"))
  removeAsset(
    @Param("roomId") roomId: string,
    @Param("assetId") assetId: string,
    @GetUser() user: User,
  ) {
    return this.rooms.removeAsset(roomId, assetId, user);
  }

  private cookieName(roomId: string) {
    return `room_${roomId}_token`;
  }

  private token(request: Request, roomId: string): string | undefined {
    return request.cookies?.[this.cookieName(roomId)];
  }

  private setToken(response: Response, roomId: string, token: string) {
    response.cookie(this.cookieName(roomId), token, {
      path: `/api/rooms/${roomId}`,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
}
