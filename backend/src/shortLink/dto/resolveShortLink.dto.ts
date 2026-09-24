import { IsOptional, IsString, MaxLength } from "class-validator";

export class ResolveShortLinkDTO {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  password?: string;
}
