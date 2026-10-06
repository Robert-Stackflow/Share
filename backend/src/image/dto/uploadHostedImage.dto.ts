import { ImageVisibility } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class UploadHostedImageDTO {
  @IsOptional()
  @IsEnum(ImageVisibility)
  visibility?: ImageVisibility;
}
