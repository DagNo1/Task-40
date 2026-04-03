import { Injectable } from "@nestjs/common";
import { AuthActor } from "../../common/authz/object-access.policy";
import { HotReadCacheService } from "../cache/hot-read-cache.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: HotReadCacheService
  ) {}

  async searchAuditLogs(filters: {
    from?: Date;
    to?: Date;
    userId?: string;
    actionType?: string;
  }, actor?: AuthActor) {
    const key = `hot:reports:audit:${this.actorScope(actor)}:${filters.from?.toISOString() ?? ""}:${filters.to?.toISOString() ?? ""}:${filters.userId ?? ""}:${filters.actionType ?? ""}`;

    return this.cache.getOrLoad(key, async () => {
      const where: Record<string, unknown> = {};

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
        take: 2000
      });
    });
  }

  private actorScope(actor?: AuthActor): string {
    const user = actor?.userId ?? "anon";
    const roles = (actor?.roles ?? []).slice().sort().join(",");
    const permissions = (actor?.permissions ?? []).slice().sort().join(",");
    return `${user}|${roles}|${permissions}`;
  }

  toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = ["id", "createdAt", "userId", "actionType", "entityType", "entityId", "notes"];
    const escape = (value: unknown) => {
      const text = `${value ?? ""}`.replace(/"/g, '""');
      return `"${text}"`;
    };
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((header) => escape(row[header])).join(","));
    });
    return lines.join("\n");
  }
}
