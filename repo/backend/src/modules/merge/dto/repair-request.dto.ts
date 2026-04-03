import { IsOptional, IsString, MinLength } from "class-validator";

export class RepairRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsString()
  @MinLength(8)
  note!: string;
}
