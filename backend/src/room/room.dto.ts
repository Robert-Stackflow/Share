import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";

export class CreateRoomDTO {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MinLength(4) passcode?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}

export class UpdateRoomDTO {
  @IsOptional() @IsString() name?: string | null;
  @IsOptional() @IsString() @MinLength(4) passcode?: string | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}

export class VerifyRoomDTO {
  @IsOptional() @IsString() passcode?: string;
}
