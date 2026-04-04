import { Injectable } from "@nestjs/common";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { HotReadCacheService } from "../cache/hot-read-cache.service";
import { PrismaService } from "../prisma/prisma.service";

interface AuditInput {
  userId?: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  notes: string;
  metadata?: InputJsonValue;
}

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: HotReadCacheService
  ) {}

  async write(input: AuditInput): Promise<void> {
    await this.prisma.immutableAuditLog.create({
      data: {
        userId: input.userId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        notes: input.notes,
        metadata: input.metadata
      }
    });

    await this.cache.invalidatePatterns(["hot:reports:audit:*", "hot:transactions:history:*"]);
  }
}
