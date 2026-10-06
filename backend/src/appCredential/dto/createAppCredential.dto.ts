import { AppCredentialType } from "@prisma/client";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { AppCredentialScope } from "../appCredential.types";

export class CreateAppCredentialDTO {
  @IsString()
  @Length(1, 64)
  name: string;

  @IsEnum(AppCredentialType)
  type: AppCredentialType;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AppCredentialScope, { each: true })
  scopes?: AppCredentialScope[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
