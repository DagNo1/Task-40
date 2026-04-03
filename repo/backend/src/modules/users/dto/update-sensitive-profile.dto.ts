import { IsOptional, IsString } from "class-validator";

export class UpdateSensitiveProfileDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  vendorHandle?: string;
}
