import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerModule } from "../ledger/ledger.module";
import { RefundsService } from "./refunds.service";

@Module({
  imports: [LedgerModule, AuditLogsModule],
  providers: [RefundsService],
  exports: [RefundsService]
})
export class RefundsModule {}
