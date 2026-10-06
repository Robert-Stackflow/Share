import { ImageVisibility } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateHostedImageDTO {
  @IsOptional()
  @IsEnum(ImageVisibility)
  visibility?: ImageVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID("4")
  albumId?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(48, { each: true })
  tags?: string[];
}
