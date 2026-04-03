import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import { SetThresholdDto } from "./dto/set-threshold.dto";
import { SetUserRateLimitDto } from "./dto/set-user-rate-limit.dto";
import { SetUserRolesDto } from "./dto/set-user-roles.dto";
import { UpsertRoleDto } from "./dto/upsert-role.dto";

const ALLOWED_THRESHOLD_KEYS = new Set([
  "SIMHASH_MAX_HAMMING",
  "MINHASH_MIN_SIMILARITY",
  "LICENSED_STORY_BUNDLE_CENTS",
  "DEFAULT_RATE_LIMIT_RPM"
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly rateLimitService: RateLimitService
  ) {}

  async getOverview() {
    const [roles, permissions, users, thresholds] = await Promise.all([
      this.prisma.role.findMany({ include: { rolePerms: { include: { permission: true } } }, orderBy: { name: "asc" } }),
      this.prisma.permission.findMany({ orderBy: { key: "asc" } }),
      this.prisma.user.findMany({
        include: {
          userRoles: { include: { role: true } },
          customRateLimit: true
        },
        orderBy: { username: "asc" }
      }),
      this.prisma.systemThresholdConfig.findMany({ orderBy: { key: "asc" } })
    ]);

    return {
      roles: roles.map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissionKeys: role.rolePerms.map((rp: any) => rp.permission.key)
      })),
      permissions,
      users: users.map((user: any) => ({
        id: user.id,
        username: user.username,
        roleIds: user.userRoles.map((ur: any) => ur.roleId),
        roleNames: user.userRoles.map((ur: any) => ur.role.name),
        requestsPerMinute: user.customRateLimit?.requestsPerMinute ?? 60
      })),
      thresholds
    };
  }

  async upsertRole(actorUserId: string | undefined, dto: UpsertRoleDto) {
    if (dto.changeNote.trim().length < 8) {
      throw new BadRequestException("Change note is required");
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } }
    });
    const missing = dto.permissionKeys.filter((key) => !permissions.some((perm: any) => perm.key === key));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown permission keys: ${missing.join(", ")}`);
    }

    const role = dto.roleId
      ? await this.prisma.role.update({
          where: { id: dto.roleId },
          data: {
            name: dto.name,
            description: dto.description
          }
        })
      : await this.prisma.role.create({
          data: {
            name: dto.name,
            description: dto.description
          }
        });

    await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissions.map((permission: any) => ({
          roleId: role.id,
          permissionId: permission.id
        }))
      });
    }

    await this.auditLogs.write({
      userId: actorUserId,
      actionType: "PERMISSION_CHANGE",
      entityType: "role",
      entityId: role.id,
      notes: dto.changeNote,
      metadata: {
        roleName: role.name,
        permissionKeys: dto.permissionKeys
      }
    });

    return role;
  }

  async setUserRoles(actorUserId: string | undefined, userId: string, dto: SetUserRolesDto) {
    if (dto.changeNote.trim().length < 8) {
      throw new BadRequestException("Change note is required");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException("One or more role IDs are invalid");
    }

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({
      data: roles.map((role: any) => ({ userId, roleId: role.id }))
    });

    await this.auditLogs.write({
      userId: actorUserId,
      actionType: "PERMISSION_CHANGE",
      entityType: "user",
      entityId: userId,
      notes: dto.changeNote,
      metadata: {
        username: user.username,
        roleIds: dto.roleIds
      }
    });

    return { status: "ok", userId, roleIds: dto.roleIds };
  }

  async setUserRateLimit(actorUserId: string | undefined, userId: string, dto: SetUserRateLimitDto) {
    if (dto.changeNote.trim().length < 8) {
      throw new BadRequestException("Change note is required");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const row = await this.rateLimitService.upsertPerUserLimit(
      userId,
      dto.requestsPerMinute,
      actorUserId
    );

    await this.auditLogs.write({
      userId: actorUserId,
      actionType: "THRESHOLD_CONFIG_CHANGE",
      entityType: "user_rate_limit",
      entityId: userId,
      notes: dto.changeNote,
      metadata: {
        username: user.username,
        requestsPerMinute: dto.requestsPerMinute
      }
    });

    return row;
  }

  async setThreshold(actorUserId: string | undefined, key: string, dto: SetThresholdDto) {
    if (!ALLOWED_THRESHOLD_KEYS.has(key)) {
      throw new BadRequestException("Unsupported threshold key");
    }
    if (dto.changeNote.trim().length < 8) {
      throw new BadRequestException("Change note is required");
    }

    const row = await this.prisma.systemThresholdConfig.upsert({
      where: { key },
      update: {
        value: dto.value,
        updatedByUserId: actorUserId
      },
      create: {
        key,
        value: dto.value,
        updatedByUserId: actorUserId,
        description: `Admin managed threshold for ${key}`
      }
    });

    await this.auditLogs.write({
      userId: actorUserId,
      actionType: "THRESHOLD_CONFIG_CHANGE",
      entityType: "system_threshold",
      entityId: key,
      notes: dto.changeNote,
      metadata: {
        key,
        value: dto.value
      }
    });

    return row;
  }

  async getPermissionSensitiveOperations(filters: {
    from?: Date;
    to?: Date;
    userId?: string;
    actionType?: string;
  }) {
    const where: Record<string, unknown> = {
      actionType: {
        in: [
          "MERGE_APPLIED",
          "REPAIR_APPLIED",
          "CHARGE_APPROVED",
          "REFUND_APPLIED",
          "TRANSACTION_FROZEN",
          "TRANSACTION_RELEASED",
          "PERMISSION_CHANGE",
          "THRESHOLD_CONFIG_CHANGE",
          "AUTH_LOGIN_SUCCESS",
          "AUTH_LOGIN_FAILED",
          "AUTH_LOGOUT",
          "AUTH_MFA_ENROLL",
          "AUTH_MFA_VERIFIED"
        ]
      }
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.actionType) {
      where.actionType = filters.actionType;
    }
    if (filters.from || filters.to) {
      where.createdAt = {
        gte: filters.from,
        lte: filters.to
      };
    }

    return this.prisma.immutableAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500
    });
  }
}
