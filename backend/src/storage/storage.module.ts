import { Global, Module } from "@nestjs/common";
import { S3ObjectStorageService } from "./s3ObjectStorage.service";

@Global()
@Module({
  providers: [S3ObjectStorageService],
  exports: [S3ObjectStorageService],
})
export class StorageModule {}
