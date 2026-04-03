import { Module } from "@nestjs/common";
import { CleansingService } from "./cleansing.service";

@Module({
  providers: [CleansingService],
  exports: [CleansingService]
})
export class CleansingModule {}
