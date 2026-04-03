import { IsString, Matches } from "class-validator";

export class SetThresholdDto {
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  value!: string;

  @IsString()
  changeNote!: string;
}
