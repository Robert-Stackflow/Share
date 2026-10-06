import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { AppCredentialService } from "./appCredential.service";
import { CreateAppCredentialDTO } from "./dto/createAppCredential.dto";

@Controller("app-credentials")
@UseGuards(AuthGuard("jwt"))
export class AppCredentialController {
  constructor(private readonly credentials: AppCredentialService) {}

  @Get()
  list(@GetUser() user: User) {
    return this.credentials.list(user.id);
  }

  @Post()
  create(@GetUser() user: User, @Body() input: CreateAppCredentialDTO) {
    return this.credentials.create(user, input);
  }

  @Delete(":id")
  revoke(@GetUser() user: User, @Param("id") id: string) {
    return this.credentials.revoke(id, user.id);
  }
}
