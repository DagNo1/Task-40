import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { PaymentChannelsService } from "./payment-channels.service";

@Module({
  imports: [TransactionsModule, AuditLogsModule],
  providers: [PaymentChannelsService],
  exports: [PaymentChannelsService]
})
export class PaymentChannelsModule {}
