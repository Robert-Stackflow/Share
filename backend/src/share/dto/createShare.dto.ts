import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";
import { ShareSecurityDTO } from "./shareSecurity.dto";

export class CreateShareDTO {
  @IsIn(["LINK", "PICKUP"])
  @IsOptional()
  deliveryMode?: "LINK" | "PICKUP";

  @IsOptional()
  @Matches(/^\d{6}$/)
  pickupCode?: string;

  @IsString()
  @Matches("^[a-zA-Z0-9_-]*$", undefined, {
    message: i18nValidationMessage("validation.idPattern"),
  })
  @Length(3, 50)
  id: string;

  @Length(3, 30)
  @IsOptional()
  name: string;

  @IsString()
  expiration: string;

  @MaxLength(512)
  @IsOptional()
  description: string;

  @IsEmail({}, { each: true })
  recipients: string[];

  @ValidateNested()
  @Type(() => ShareSecurityDTO)
  security: ShareSecurityDTO;

  @IsNumber()
  @IsOptional()
  size: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
