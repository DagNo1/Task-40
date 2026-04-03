import { IsString, MinLength } from "class-validator";

export class FreezeTransactionDto {
  @IsString()
  @MinLength(8)
  note!: string;
}
