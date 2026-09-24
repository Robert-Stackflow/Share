import { Expose, plainToClass } from "class-transformer";

export class AssetDTO {
  @Expose()
  id: string;

  @Expose()
  createdAt: Date;

  @Expose()
  type: string;

  @Expose()
  ownerId?: string;

  @Expose()
  shareId?: string;

  @Expose()
  roomId?: string;

  @Expose()
  name?: string;

  @Expose()
  size?: string;

  @Expose()
  mimeType?: string;

  @Expose()
  storage?: string;

  @Expose()
  content?: string;

  @Expose()
  url?: string;

  from(partial: Partial<AssetDTO>) {
    return plainToClass(AssetDTO, partial, { excludeExtraneousValues: true });
  }
}
