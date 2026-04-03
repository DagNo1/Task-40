import { Module } from "@nestjs/common";
import { DedupService } from "./dedup.service";
import { FingerprintService } from "./fingerprint.service";

@Module({
  providers: [FingerprintService, DedupService],
  exports: [FingerprintService, DedupService]
})
export class DedupModule {}
