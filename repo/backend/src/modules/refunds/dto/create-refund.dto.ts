import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateRefundDto {
  @IsString()
  @IsIn(["full", "partial"])
  type!: "full" | "partial";

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsString()
  @IsUUID()
  storyVersionId!: string;

  @IsString()
  @MinLength(8)
  note!: string;
}
