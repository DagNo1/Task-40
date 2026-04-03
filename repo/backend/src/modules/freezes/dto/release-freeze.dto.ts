import { IsString, MinLength } from "class-validator";

export class ReleaseFreezeDto {
  @IsString()
  @MinLength(8)
  note!: string;
}
