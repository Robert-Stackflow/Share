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
import { SystemService } from "./system.service";
import { SystemInfoDTO } from "./dto/systemInfo.dto";
import {
  StorageConnectionTest,
  StorageStatus,
} from "src/storage/storage.types";
import { StorageProvider } from "@prisma/client";

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
}
