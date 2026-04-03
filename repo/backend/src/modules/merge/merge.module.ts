import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CleansingModule } from "../cleansing/cleansing.module";
import { MergeService } from "./merge.service";

@Module({
  imports: [AuditLogsModule, CleansingModule],
  providers: [MergeService],
  exports: [MergeService]
})
export class MergeModule {}
