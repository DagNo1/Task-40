import { Controller, Get, Query, Req, Res, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { ReportsService } from "../../modules/reports/reports.service";
import { parseDateRangeStrict } from "../reports-date.util";

@ApiTags("reports-v1")
@Controller("reports")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("audit.read")
export class ReportsV1Controller {
  constructor(private readonly reports: ReportsService) {}

  @Get("audit")
  @Version("1")
  async search(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("actionType") actionType: string | undefined,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    const items = await this.reports.searchAuditLogs({
      from: parseDateRangeStrict(from),
      to: parseDateRangeStrict(to, true),
      userId,
      actionType
    }, request.auth);
    return { items };
  }

  @Get("audit/export.csv")
  @Version("1")
  async exportCsv(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("actionType") actionType: string | undefined,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } },
    @Res() response: Response
  ) {
    const items = await this.reports.searchAuditLogs({
      from: parseDateRangeStrict(from),
      to: parseDateRangeStrict(to, true),
      userId,
      actionType
    }, request.auth);
    const csv = this.reports.toCsv(items as unknown as Array<Record<string, unknown>>);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", `attachment; filename="audit-report.csv"`);
    response.status(200).send(csv);
  }
}
