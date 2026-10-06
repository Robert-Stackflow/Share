import { ImageVisibility } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from "class-validator";
import { MAX_HOSTED_IMAGE_BATCH_SIZE } from "../image.types";

export class BatchHostedImageDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_HOSTED_IMAGE_BATCH_SIZE)
  @IsUUID("4", { each: true })
  ids: string[];
}

export class BatchUpdateHostedImageDTO extends BatchHostedImageDTO {
  @IsOptional()
  @IsEnum(ImageVisibility)
  visibility?: ImageVisibility;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID("4")
  albumId?: string | null;
}

export class AdminBatchUpdateHostedImageDTO extends BatchHostedImageDTO {
  @IsEnum(ImageVisibility)
  visibility: ImageVisibility;
}
