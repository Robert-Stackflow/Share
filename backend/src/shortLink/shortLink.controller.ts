import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { Request, Response } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { CreateShortLinkDTO } from "./dto/createShortLink.dto";
import { UpdateShortLinkDTO } from "./dto/updateShortLink.dto";
import { ShortLinkService } from "./shortLink.service";
import { OptionalShortLinkJwtGuard } from "./shortLink.guard";
import { ResolveShortLinkDTO } from "./dto/resolveShortLink.dto";

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
  @UseGuards(OptionalShortLinkJwtGuard)
  async visit(
    @Param("code") code: string,
    @Req() request: Request,
    @Res() response: Response,
    @GetUser() user?: User,
  ) {
    const targetUrl = await this.shortLinkService.recordVisit(code, {
      ip: this.getClientIp(request),
      userAgent: request.headers["user-agent"],
      referer: request.headers.referer,
    }, { userId: user?.id });
    response.redirect(302, targetUrl);
  }

  @Get(":code/access")
  @UseGuards(OptionalShortLinkJwtGuard)
  access(@Param("code") code: string) {
    return this.shortLinkService.getAccessStatus(code);
  }

  @Post(":code/resolve")
  @HttpCode(200)
  @UseGuards(OptionalShortLinkJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async resolve(
    @Param("code") code: string,
    @Body() body: ResolveShortLinkDTO,
    @Req() request: Request,
    @GetUser() user?: User,
  ) {
    const targetUrl = await this.shortLinkService.recordVisit(code, {
      ip: this.getClientIp(request),
      userAgent: request.headers["user-agent"],
      referer: request.headers.referer,
    }, { password: body.password, userId: user?.id });
    return { targetUrl };
  }

  @Get(":code/open")
  @UseGuards(OptionalShortLinkJwtGuard)
  async open(
    @Param("code") code: string,
    @Req() request: Request,
    @Res() response: Response,
    @GetUser() user?: User,
  ) {
    try {
      const status = await this.shortLinkService.getAccessStatus(code);
      if (status.status !== "active" || status.requiresPassword || (status.requiresSignIn && !user)) {
        response.redirect(302, `/short-link-access/?code=${encodeURIComponent(code)}`);
        return;
      }
      const targetUrl = await this.shortLinkService.recordVisit(code, {
        ip: this.getClientIp(request),
        userAgent: request.headers["user-agent"],
        referer: request.headers.referer,
      }, { userId: user?.id });
      response.redirect(302, targetUrl);
      return;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        response.redirect(302, `/short-link-access/?code=${encodeURIComponent(code)}`);
        return;
      }
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
