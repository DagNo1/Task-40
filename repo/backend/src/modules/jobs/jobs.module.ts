import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ObservabilityModule } from "../observability/observability.module";
import { JobsService } from "./jobs.service";
import { JobQueueService } from "./job-queue.service";
import { BackupCommandService } from "./backup-command.service";

@Module({
  imports: [AuditLogsModule, ObservabilityModule],
  providers: [JobQueueService, BackupCommandService, JobsService],
  exports: [JobQueueService, JobsService]
})
export class JobsModule {}
