import { Readable } from "stream";
import { StorageChunk } from "src/storage/storage.types";

export type AssetFileChunk = StorageChunk;

export interface AssetStorageService {
  saveChunk(
    assetId: string,
    data: string | Buffer,
    chunk: AssetFileChunk,
  ): Promise<void>;
  getSize(assetId: string): Promise<number>;
  getStream(assetId: string): Promise<Readable>;
  copy(sourceAssetId: string, targetAssetId: string): Promise<void>;
  remove(assetId: string): Promise<void>;
}
