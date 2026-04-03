import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { ObservabilityModule } from "../observability/observability.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [JobsModule, ObservabilityModule],
  controllers: [HealthController]
})
export class HealthModule {}
