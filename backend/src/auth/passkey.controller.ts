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
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "@nestjs/passport";
import { User } from "@prisma/client";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { GetUser } from "./decorator/getUser.decorator";
import { PasskeyService } from "./passkey.service";

@Controller("auth/passkeys")
export class PasskeyController {
  constructor(
    private passkeys: PasskeyService,
    private auth: AuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  list(@GetUser() user: User) {
    return this.passkeys.list(user);
  }

  @Post("register/options")
  @UseGuards(AuthGuard("jwt"))
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  registrationOptions(@GetUser() user: User, @Req() request: Request) {
    return this.passkeys.registrationOptions(
      user,
      request.cookies.access_token,
    );
  }

  @Post("register/verify")
  @UseGuards(AuthGuard("jwt"))
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  verifyRegistration(
    @GetUser() user: User,
    @Req() request: Request,
    @Body()
    body: {
      challengeId: string;
      response: RegistrationResponseJSON;
      name: string;
    },
  ) {
    return this.passkeys.verifyRegistration(
      user,
      request.cookies.access_token,
      body.challengeId,
      body.response,
      body.name,
      request.ip,
      request.headers["user-agent"],
    );
  }

  @Post("login/options")
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  authenticationOptions() {
    return this.passkeys.authenticationOptions();
  }

  @Post("login/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  async verifyAuthentication(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { challengeId: string; response: AuthenticationResponseJSON },
  ) {
    const result = await this.passkeys.verifyAuthentication(
      body.challengeId,
      body.response,
      request.ip,
      request.headers["user-agent"],
    );
    if (result.accessToken && result.refreshToken)
      this.auth.addTokensToResponse(
        response,
        result.refreshToken,
        result.accessToken,
      );
    return result;
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  rename(
    @GetUser() user: User,
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: { name: string },
  ) {
    return this.passkeys.rename(
      user,
      request.cookies.access_token,
      id,
      body.name,
    );
  }

  @Delete(":id")
  @HttpCode(204)
  @UseGuards(AuthGuard("jwt"))
  remove(
    @GetUser() user: User,
    @Req() request: Request,
    @Param("id") id: string,
  ) {
    return this.passkeys.remove(user, request.cookies.access_token, id);
  }
}
