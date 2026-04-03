import { IsInt, IsString, Max, Min } from "class-validator";

export class SetUserRateLimitDto {
  @IsInt()
  @Min(1)
  @Max(2000)
  requestsPerMinute!: number;

  @IsString()
  changeNote!: string;
}
