import { Module } from "@nestjs/common";
import { AdminModule } from "../../modules/admin/admin.module";
import { FreezesModule } from "../../modules/freezes/freezes.module";
import { IngestionModule } from "../../modules/ingestion/ingestion.module";
import { JobsModule } from "../../modules/jobs/jobs.module";
import { MergeModule } from "../../modules/merge/merge.module";
import { PaymentChannelsModule } from "../../modules/payment-channels/payment-channels.module";
import { ReportsModule } from "../../modules/reports/reports.module";
import { RefundsModule } from "../../modules/refunds/refunds.module";
import { StoriesModule } from "../../modules/stories/stories.module";
import { TransactionsModule } from "../../modules/transactions/transactions.module";
import { UsersModule } from "../../modules/users/users.module";
import { AdminV2Controller } from "./admin-v2.controller";
import { AlertsV2Controller } from "./alerts-v2.controller";
import { AuthV2Controller } from "./auth-v2.controller";
import { EditorQueueV2Controller } from "./editor-queue-v2.controller";
import { IngestionV2Controller } from "./ingestion-v2.controller";
import { PaymentChannelsV2Controller } from "./payment-channels-v2.controller";
import { ReportsV2Controller } from "./reports-v2.controller";
import { StoriesV2Controller } from "./stories-v2.controller";
import { TransactionsV2Controller } from "./transactions-v2.controller";
import { ProfileV2Controller } from "./profile-v2.controller";

@Module({
  imports: [
    IngestionModule,
    MergeModule,
    TransactionsModule,
    RefundsModule,
    FreezesModule,
    PaymentChannelsModule,
    AdminModule,
    ReportsModule,
    StoriesModule,
    JobsModule,
    UsersModule
  ],
  controllers: [
    AdminV2Controller,
    AlertsV2Controller,
    AuthV2Controller,
    IngestionV2Controller,
    EditorQueueV2Controller,
    TransactionsV2Controller,
    StoriesV2Controller,
    PaymentChannelsV2Controller,
    ReportsV2Controller,
    ProfileV2Controller
  ]
})
export class ApiV2Module {}
