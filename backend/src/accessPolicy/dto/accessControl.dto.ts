import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class AccessControlDTO {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxViews?: number | null;

  @IsOptional()
  @IsBoolean()
  allowDownload?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  oneTime?: boolean;
}
