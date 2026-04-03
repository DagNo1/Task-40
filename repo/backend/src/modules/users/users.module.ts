import { Module } from "@nestjs/common";
import { SensitiveProfileService } from "./sensitive-profile.service";

@Module({
  providers: [SensitiveProfileService],
  exports: [SensitiveProfileService]
})
export class UsersModule {}
