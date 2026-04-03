import { Body, Controller, Get, Param, Put, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { AdminService } from "../../modules/admin/admin.service";
import { SetThresholdDto } from "../../modules/admin/dto/set-threshold.dto";
import { SetUserRateLimitDto } from "../../modules/admin/dto/set-user-rate-limit.dto";
import { SetUserRolesDto } from "../../modules/admin/dto/set-user-roles.dto";
import { UpsertRoleDto } from "../../modules/admin/dto/upsert-role.dto";
import { CsrfGuard } from "../../security/csrf/csrf.guard";

function parseDateRange(value?: string, endOfDay = false): Date | undefined {
  if (!value) {
    return undefined;
  }
  const [month, day, year] = value.split("/").map((v) => Number.parseInt(v, 10));
  if (!month || !day || !year) {
    return undefined;
  }
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

@ApiTags("admin-v1")
@Controller("admin")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("admin.manage")
export class AdminV1Controller {
  constructor(private readonly adminService: AdminService) {}

  @Get("overview")
  @Version("1")
  async overview() {
    return this.adminService.getOverview();
  }

  @Put("roles")
  @Version("1")
  @UseGuards(CsrfGuard)
  async upsertRole(
    @Body() payload: UpsertRoleDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.adminService.upsertRole(request.auth?.userId, payload);
  }

  @Put("users/:id/roles")
  @Version("1")
  @UseGuards(CsrfGuard)
  async setUserRoles(
    @Param("id") userId: string,
    @Body() payload: SetUserRolesDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.adminService.setUserRoles(request.auth?.userId, userId, payload);
  }

  @Put("users/:id/rate-limit")
  @Version("1")
  @UseGuards(CsrfGuard)
  async setUserRateLimit(
    @Param("id") userId: string,
    @Body() payload: SetUserRateLimitDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.adminService.setUserRateLimit(request.auth?.userId, userId, payload);
  }

  @Put("thresholds/:key")
  @Version("1")
  @UseGuards(CsrfGuard)
  async setThreshold(
    @Param("key") key: string,
    @Body() payload: SetThresholdDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.adminService.setThreshold(request.auth?.userId, key, payload);
  }

  @Get("operations/permission-sensitive")
  @Version("1")
  async permissionSensitive(
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("userId") userId: string | undefined,
    @Query("actionType") actionType: string | undefined
  ) {
    return this.adminService.getPermissionSensitiveOperations({
      from: parseDateRange(from),
      to: parseDateRange(to, true),
      userId,
      actionType
    });
  }
}
