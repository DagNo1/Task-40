import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ChannelChargeDto {
  @IsOptional()
  @IsString()
  storyVersionId?: string;

  @IsInt()
  @Min(1)
  bundleCount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  callbackReference?: string;
}
