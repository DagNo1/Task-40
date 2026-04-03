import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuditLogsModule, RateLimitModule],
  providers: [AdminService],
  exports: [AdminService]
})
export class AdminModule {}
