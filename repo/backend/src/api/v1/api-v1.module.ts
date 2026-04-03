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
import { AdminV1Controller } from "./admin-v1.controller";
import { AlertsV1Controller } from "./alerts-v1.controller";
import { AuthV1Controller } from "./auth-v1.controller";
import { EditorQueueV1Controller } from "./editor-queue-v1.controller";
import { IngestionV1Controller } from "./ingestion-v1.controller";
import { PaymentChannelsV1Controller } from "./payment-channels-v1.controller";
import { ReportsV1Controller } from "./reports-v1.controller";
import { StoriesV1Controller } from "./stories-v1.controller";
import { TransactionsV1Controller } from "./transactions-v1.controller";
import { ProfileV1Controller } from "./profile-v1.controller";

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
    AdminV1Controller,
    AlertsV1Controller,
    AuthV1Controller,
    IngestionV1Controller,
    EditorQueueV1Controller,
    TransactionsV1Controller,
    StoriesV1Controller,
    PaymentChannelsV1Controller,
    ReportsV1Controller,
    ProfileV1Controller
  ]
})
export class ApiV1Module {}
