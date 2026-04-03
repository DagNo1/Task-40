import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from "class-validator";

export class UpsertRoleDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissionKeys!: string[];

  @IsString()
  changeNote!: string;
}
