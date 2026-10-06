import { Global, Module } from "@nestjs/common";
import { S3ObjectStorageService } from "./s3ObjectStorage.service";
import { StorageService } from "./storage.service";

@Global()
@Module({
  providers: [S3ObjectStorageService, StorageService],
  exports: [S3ObjectStorageService, StorageService],
})
export class StorageModule {}
