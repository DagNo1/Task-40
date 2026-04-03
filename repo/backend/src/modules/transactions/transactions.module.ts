import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TransactionsService } from "./transactions.service";

@Module({
  imports: [LedgerModule, AuditLogsModule],
  providers: [TransactionsService],
  exports: [TransactionsService]
})
export class TransactionsModule {}
