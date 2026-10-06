import { Module } from "@nestjs/common";
import { AppCredentialModule } from "src/appCredential/appCredential.module";
import { AssetModule } from "src/asset/asset.module";
import {
  ImageApiController,
  ImageController,
  PublicImageController,
} from "./image.controller";
import { ImageService } from "./image.service";

@Module({
  imports: [AssetModule, AppCredentialModule],
  controllers: [ImageController, ImageApiController, PublicImageController],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
