import { ImageVisibility } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  IMAGE_OUTPUT_FORMATS,
  IMAGE_WATERMARK_POSITIONS,
  ImageOutputFormat,
  ImageWatermarkPosition,
} from "../image.types";

export class UpdateImagePreferenceDTO {
  @IsOptional()
  @IsEnum(ImageVisibility)
  defaultVisibility?: ImageVisibility;

  @IsOptional()
  @IsBoolean()
  autoOrient?: boolean;

  @IsOptional()
  @IsBoolean()
  stripMetadata?: boolean;

  @IsOptional()
  @IsIn(IMAGE_OUTPUT_FORMATS)
  outputFormat?: ImageOutputFormat;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(16384)
  maxWidth?: number | null;

  @IsOptional()
  @IsBoolean()
  deduplicate?: boolean;

  @IsOptional()
  @IsBoolean()
  watermarkEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  watermarkText?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  watermarkOpacity?: number;

  @IsOptional()
  @IsIn(IMAGE_WATERMARK_POSITIONS)
  watermarkPosition?: ImageWatermarkPosition;
}
