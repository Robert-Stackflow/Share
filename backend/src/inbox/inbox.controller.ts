import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CreateReverseShareDTO } from "src/reverseShare/dto/createReverseShare.dto";
import { ReverseShareDTO } from "src/reverseShare/dto/reverseShare.dto";
import { ReverseShareTokenWithShares } from "src/reverseShare/dto/reverseShareTokenWithShares";
import { InboxService } from "./inbox.service";

@Controller("inboxes")
export class InboxController {
  constructor(private inboxService: InboxService) {}

  @Post()
  @UseGuards(JwtGuard)
  async create(@Body() body: CreateReverseShareDTO, @GetUser() user: User) {
    return this.inboxService.create(body, user.id);
  }

  @Get()
  @UseGuards(JwtGuard)
  async list(@GetUser() user: User) {
    return new ReverseShareTokenWithShares().fromList(
      await this.inboxService.listByOwner(user.id),
    );
  }

  @Post(":token/submissions")
  async createSubmission(@Param("token") token: string, @Body() body: any) {
    return this.inboxService.createSubmission(token, body);
  }

  @Post(":token/submissions/:id/files")
  async addSubmissionFile(
    @Param("token") token: string,
    @Param("id") id: string,
    @Query()
    query: {
      id?: string;
      name: string;
      chunkIndex: string;
      totalChunks: string;
    },
    @Body() body: string,
  ) {
    return this.inboxService.addSubmissionFile(
      token,
      id,
      body,
      { index: parseInt(query.chunkIndex), total: parseInt(query.totalChunks) },
      { id: query.id, name: query.name },
    );
  }

  @Post(":token/submissions/:id/complete")
  async completeSubmission(
    @Param("token") token: string,
    @Param("id") id: string,
  ) {
    return this.inboxService.completeSubmission(token, id);
  }

  @Post(":token/submissions/:id/cancel")
  async cancelSubmission(
    @Param("token") token: string,
    @Param("id") id: string,
  ) {
    return this.inboxService.cancelSubmission(token, id);
  }

  @Get(":id/submissions")
  @UseGuards(JwtGuard)
  async listSubmissions(@Param("id") id: string, @GetUser() user: User) {
    return this.inboxService.listSubmissions(id, user.id);
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60,
    },
  })
  @Get(":token")
  async getByToken(@Param("token") token: string) {
    return new ReverseShareDTO().from(
      await this.inboxService.getByToken(token),
    );
  }

  @Delete(":id")
  @UseGuards(JwtGuard)
  async remove(@Param("id") id: string, @GetUser() user: User) {
    await this.inboxService.removeOwned(id, user.id);
  }
}

@Controller("inbox-submissions")
export class InboxSubmissionController {
  constructor(private inboxService: InboxService) {}

  @Post(":id/accept")
  @UseGuards(JwtGuard)
  async accept(
    @Param("id") id: string,
    @Body() body: { createShare?: boolean; roomId?: string },
    @GetUser() user: User,
  ) {
    return this.inboxService.acceptSubmission(id, user, body);
  }

  @Post(":id/reject")
  @UseGuards(JwtGuard)
  async reject(@Param("id") id: string, @GetUser() user: User) {
    return this.inboxService.rejectSubmission(id, user);
  }
}
