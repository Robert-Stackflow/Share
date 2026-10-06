import { Injectable } from "@nestjs/common";
import { S3ObjectStorageService } from "src/storage/s3ObjectStorage.service";
import { AssetFileChunk, AssetStorageService } from "./asset.storage";

@Injectable()
export class AssetS3StorageService implements AssetStorageService {
  constructor(private readonly objects: S3ObjectStorageService) {}

  async saveChunk(
    assetId: string,
    data: string | Buffer,
    chunk: AssetFileChunk,
  ) {
    try {
      await this.objects.saveChunk(
        assetId,
        this.objects.assetKey(assetId),
        data,
        chunk,
      );
    } catch (error) {
      await this.objects.abortMultipart(assetId);
      throw error;
    }
  }

  async getSize(assetId: string): Promise<number> {
    return this.objects.getSize(this.objects.assetKey(assetId));
  }

  async getStream(assetId: string) {
    return (await this.objects.getStream(this.objects.assetKey(assetId))).body;
  }

  async copy(sourceAssetId: string, targetAssetId: string) {
    await this.objects.copy(
      this.objects.assetKey(sourceAssetId),
      this.objects.assetKey(targetAssetId),
    );
  }

  async remove(assetId: string) {
    await this.objects.abortMultipart(assetId);
    await this.objects.delete(this.objects.assetKey(assetId));
  }
}
