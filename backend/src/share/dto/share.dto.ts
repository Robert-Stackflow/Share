import { Expose, plainToClass, Type } from "class-transformer";
import { AssetDTO } from "src/asset/dto/asset.dto";
import { FileDTO } from "src/file/dto/file.dto";
import { PublicUserDTO } from "src/user/dto/publicUser.dto";

export class ShareDTO {
  @Expose()
  id: string;

  @Expose()
  pickupCode?: string;

  @Expose()
  name?: string;

  @Expose()
  expiration: Date;

  @Expose()
  @Type(() => FileDTO)
  files: FileDTO[];

  @Expose()
  @Type(() => AssetDTO)
  assets?: AssetDTO[];

  @Expose()
  @Type(() => PublicUserDTO)
  creator: PublicUserDTO;

  @Expose()
  description: string;

  @Expose()
  hasPassword: boolean;

  @Expose()
  size: number;

  from(partial: Partial<ShareDTO>) {
    return plainToClass(ShareDTO, partial, { excludeExtraneousValues: true });
  }

  fromList(partial: Partial<ShareDTO>[]) {
    return partial.map((part) =>
      plainToClass(ShareDTO, part, { excludeExtraneousValues: true }),
    );
  }
}
