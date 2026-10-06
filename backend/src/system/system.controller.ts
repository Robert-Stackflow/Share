import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { SystemService } from "./system.service";
import { SystemInfoDTO } from "./dto/systemInfo.dto";
import {
  StorageAudit,
  StorageCleanupResult,
  StorageConnectionTest,
  StorageStatus,
  StorageWebDavUsage,
} from "src/storage/storage.types";
import { StorageProvider, User } from "@prisma/client";

@Controller("system")
export class SystemController {
  constructor(private systemService: SystemService) {}

  @Get("info")
  @UseGuards(JwtGuard, AdministratorGuard)
  async getSystemInfo(): Promise<SystemInfoDTO | null> {
    return await this.systemService.getSystemInfo();
  }

  @Get("storage")
  @UseGuards(JwtGuard, AdministratorGuard)
  getStorageStatus(): StorageStatus {
    return this.systemService.getStorageStatus();
  }

  @Post("storage/test")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, AdministratorGuard)
  testStorageConnection(
    @Query("provider") provider?: string,
  ): Promise<StorageConnectionTest> {
    return this.systemService.testStorageConnection(
      provider?.toUpperCase() === StorageProvider.S3
        ? StorageProvider.S3
        : undefined,
    );
  }

  @Get("storage/webdav/usage")
  @UseGuards(JwtGuard)
  getWebDavUsage(@GetUser() user: User): Promise<StorageWebDavUsage> {
    return this.systemService.getWebDavUsage(user.id);
  }

  @Post("storage/audit")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, AdministratorGuard)
  auditStorage(): Promise<StorageAudit> {
    return this.systemService.auditStorage();
  }

  @Post("storage/cleanup")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard, AdministratorGuard)
  cleanupStorage(): Promise<StorageCleanupResult> {
    return this.systemService.cleanupStorage();
  }
}
