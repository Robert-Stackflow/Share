import { Module } from "@nestjs/common";
import { AppCredentialModule } from "src/appCredential/appCredential.module";
import { WebDavService } from "./webDav.service";

@Module({
  imports: [AppCredentialModule],
  providers: [WebDavService],
  exports: [WebDavService],
})
export class WebDavModule {}
