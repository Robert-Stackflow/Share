import { IsString, Matches } from "class-validator";

export class PickupCodeDTO {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
