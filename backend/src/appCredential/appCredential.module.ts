import { Module } from "@nestjs/common";
import { AppCredentialController } from "./appCredential.controller";
import { AppCredentialGuard } from "./appCredential.guard";
import { AppCredentialService } from "./appCredential.service";

@Module({
  controllers: [AppCredentialController],
  providers: [AppCredentialService, AppCredentialGuard],
  exports: [AppCredentialService, AppCredentialGuard],
})
export class AppCredentialModule {}
