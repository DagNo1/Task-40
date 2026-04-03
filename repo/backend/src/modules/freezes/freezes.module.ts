import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerModule } from "../ledger/ledger.module";
import { FreezesService } from "./freezes.service";

@Module({
  imports: [LedgerModule, AuditLogsModule],
  providers: [FreezesService],
  exports: [FreezesService]
})
export class FreezesModule {}
