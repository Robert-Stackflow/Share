import { ImageVisibility } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateHostedImageDTO {
  @IsOptional()
  @IsEnum(ImageVisibility)
  visibility?: ImageVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
