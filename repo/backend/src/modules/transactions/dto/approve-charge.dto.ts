import { IsString, MinLength } from "class-validator";

export class ApproveChargeDto {
  @IsString()
  @MinLength(8)
  note!: string;
}
