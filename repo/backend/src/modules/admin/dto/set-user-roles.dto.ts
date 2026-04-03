import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";

export class SetUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleIds!: string[];

  @IsString()
  changeNote!: string;
}
