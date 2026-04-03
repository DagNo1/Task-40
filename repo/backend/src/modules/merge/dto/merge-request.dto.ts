import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class MergeRequestDto {
  @IsString()
  incomingVersionId!: string;

  @IsOptional()
  @IsString()
  targetStoryId?: string;

  @IsString()
  @IsIn(["replace", "append", "keep_both"])
  strategy!: "replace" | "append" | "keep_both";

  @IsString()
  @MinLength(8)
  note!: string;
}
