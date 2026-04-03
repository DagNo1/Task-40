import { Body, Controller, ForbiddenException, Get, Put, Query, Req, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { SessionGuard } from "../../common/guards/session.guard";
import { UpdateSensitiveProfileDto } from "../../modules/users/dto/update-sensitive-profile.dto";
import { SensitiveProfileService } from "../../modules/users/sensitive-profile.service";
import { CsrfGuard } from "../../security/csrf/csrf.guard";

@ApiTags("profile-v2")
@Controller("profile")
@UseGuards(SessionGuard)
export class ProfileV2Controller {
  constructor(private readonly sensitiveProfile: SensitiveProfileService) {}

  @Get("sensitive")
  @Version("2")
  async getSensitive(
    @Req() request: Request & { auth?: { userId: string; permissions: string[] } },
    @Query("userId") userId?: string
  ) {
    return this.sensitiveProfile.readForUser(this.resolveTargetUserId(request, userId));
  }

  @Put("sensitive")
  @Version("2")
  @UseGuards(CsrfGuard)
  async updateSensitive(
    @Req() request: Request & { auth?: { userId: string; permissions: string[] } },
    @Body() payload: UpdateSensitiveProfileDto,
    @Query("userId") userId?: string
  ) {
    return this.sensitiveProfile.upsertForUser(this.resolveTargetUserId(request, userId), payload);
  }

  private resolveTargetUserId(
    request: Request & { auth?: { userId: string; permissions: string[] } },
    requestedUserId?: string
  ): string {
    const actorUserId = request.auth?.userId;
    const permissions = request.auth?.permissions ?? [];
    if (!actorUserId) {
      throw new ForbiddenException("Missing actor context");
    }

    if (!requestedUserId || requestedUserId === actorUserId) {
      return actorUserId;
    }

    if (!permissions.includes("admin.manage")) {
      throw new ForbiddenException("Insufficient permissions to access another user profile");
    }

    return requestedUserId;
  }
}
