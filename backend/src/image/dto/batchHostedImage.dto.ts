import { ImageVisibility } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
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
  @IsEnum(ImageVisibility)
  visibility: ImageVisibility;
}
