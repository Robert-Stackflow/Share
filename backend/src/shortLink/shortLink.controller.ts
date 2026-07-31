import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { User } from "@prisma/client";
import { Request, Response } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { CreateShortLinkDTO } from "./dto/createShortLink.dto";
import { UpdateShortLinkDTO } from "./dto/updateShortLink.dto";
import { ShortLinkService } from "./shortLink.service";

@Controller("short-links")
export class ShortLinkController {
  constructor(private shortLinkService: ShortLinkService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async create(@Body() body: CreateShortLinkDTO, @GetUser() user: User) {
    return this.shortLinkService.create(body, user);
  }

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async list(@GetUser() user: User) {
    return this.shortLinkService.listByOwner(user.id);
  }

  @Get(":code/stats")
  @UseGuards(AuthGuard("jwt"))
  async stats(@Param("code") code: string, @GetUser() user: User) {
    return this.shortLinkService.getStats(code, user.id);
  }

  @Patch(":code")
  @UseGuards(AuthGuard("jwt"))
  async update(
    @Param("code") code: string,
    @Body() body: UpdateShortLinkDTO,
    @GetUser() user: User,
  ) {
    return this.shortLinkService.updateOwned(code, body, user.id);
  }

  @Delete(":code")
  @UseGuards(AuthGuard("jwt"))
  async remove(@Param("code") code: string, @GetUser() user: User) {
    await this.shortLinkService.removeOwned(code, user.id);
  }

  @Get(":code/visit")
  async visit(
    @Param("code") code: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const targetUrl = await this.shortLinkService.recordVisit(code, {
      ip: this.getClientIp(request),
      userAgent: request.headers["user-agent"],
      referer: request.headers.referer,
    });
    response.redirect(302, targetUrl);
  }

  @Get(":code/open")
  async open(
    @Param("code") code: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const targetUrl = await this.shortLinkService.recordVisit(code, {
        ip: this.getClientIp(request),
        userAgent: request.headers["user-agent"],
        referer: request.headers.referer,
      });
      response.redirect(302, targetUrl);
      return;
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      const recipient =
        typeof request.query.recipient === "string"
          ? `?recipient=${encodeURIComponent(request.query.recipient)}`
          : "";
      response.redirect(
        302,
        `/share/${encodeURIComponent(code)}${recipient}`,
      );
      return;
    }
  }

  private getClientIp(request: Request) {
    const forwardedFor = request.headers["x-forwarded-for"];
    if (Array.isArray(forwardedFor)) return forwardedFor[0];
    return forwardedFor?.split(",")[0]?.trim() || request.ip;
  }
}
