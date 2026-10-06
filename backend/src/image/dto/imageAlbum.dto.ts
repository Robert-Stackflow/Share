import { IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateImageAlbumDTO {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class UpdateImageAlbumDTO {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}
