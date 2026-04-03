import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthActor, ensureActorObjectAccess } from "../../common/authz/object-access.policy";
import { HotReadCacheService } from "../cache/hot-read-cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { FreezeTransactionDto } from "./dto/freeze-transaction.dto";
import { ReleaseFreezeDto } from "./dto/release-freeze.dto";

@Injectable()
export class FreezesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly auditLogs: AuditLogsService,
    private readonly cache: HotReadCacheService
  ) {}

  async freeze(actor: AuthActor | undefined, transactionId: string, dto: FreezeTransactionDto) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) {
      throw new NotFoundException("Transaction not found");
    }

    ensureActorObjectAccess(actor, {
      ownerIds: [tx.createdByUserId, tx.approvedByUserId],
      context: "transaction freeze",
      allowIfAnyPermission: ["finance.freeze", "finance.review"]
    });

    const userId = actor?.userId;
    if (tx.status === "FROZEN") {
      throw new BadRequestException("Transaction is already frozen");
    }

    const freeze = await this.prisma.freezeCase.create({
      data: {
        transactionId,
        reason: dto.note,
        frozenByUserId: userId,
        status: "FROZEN"
      }
    });

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "FROZEN",
        statusExplanation: "Transaction frozen due to dispute; only auditors can release."
      }
    });

    await this.ledger.appendEntry({
      transactionId,
      entryType: "FREEZE",
      amountCents: 0,
      createdByUserId: userId,
      metadata: {
        freezeCaseId: freeze.id,
        note: dto.note
      }
    });

    await this.auditLogs.write({
      userId,
      actionType: "TRANSACTION_FROZEN",
      entityType: "transaction",
      entityId: transactionId,
      notes: dto.note,
      metadata: {
        freezeCaseId: freeze.id,
        beforeStatus: tx.status,
        afterStatus: "FROZEN"
      }
    });

    await this.cache.invalidatePatterns(["hot:transactions:list:*", "hot:transactions:history:*"]);

    return {
      status: "ok",
      freezeCaseId: freeze.id,
      transactionStatus: "FROZEN"
    };
  }

  async release(actor: AuthActor | undefined, transactionId: string, dto: ReleaseFreezeDto) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) {
      throw new NotFoundException("Transaction not found");
    }

    ensureActorObjectAccess(actor, {
      ownerIds: [tx.createdByUserId, tx.approvedByUserId],
      context: "transaction freeze release",
      allowIfAnyPermission: ["auditor.release_freeze"],
      allowIfAnyRole: ["auditor"]
    });

    const userId = actor?.userId;
    if (tx.status !== "FROZEN") {
      throw new BadRequestException("Only frozen transactions can be released");
    }

    const activeFreeze = await this.prisma.freezeCase.findFirst({
      where: {
        transactionId,
        status: "FROZEN"
      },
      orderBy: { frozenAt: "desc" }
    });
    if (!activeFreeze) {
      throw new BadRequestException("No active freeze case found for transaction");
    }

    await this.prisma.freezeCase.update({
      where: { id: activeFreeze.id },
      data: {
        status: "RELEASED",
        releaseNote: dto.note,
        releasedByUserId: userId,
        releasedAt: new Date()
      }
    });

    const hasRefunds = (await this.prisma.refundCase.count({ where: { transactionId } })) > 0;
    const nextStatus = hasRefunds ? "REFUNDED_PARTIAL" : "APPROVED";
    const explanation = hasRefunds
      ? "Freeze released by auditor; transaction remains in refunded-partial state."
      : "Freeze released by auditor; transaction returned to approved state.";

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: nextStatus,
        statusExplanation: explanation
      }
    });

    await this.ledger.appendEntry({
      transactionId,
      entryType: "RELEASE",
      amountCents: 0,
      createdByUserId: userId,
      metadata: {
        freezeCaseId: activeFreeze.id,
        note: dto.note
      }
    });

    await this.auditLogs.write({
      userId,
      actionType: "TRANSACTION_RELEASED",
      entityType: "transaction",
      entityId: transactionId,
      notes: dto.note,
      metadata: {
        freezeCaseId: activeFreeze.id,
        beforeStatus: tx.status,
        afterStatus: nextStatus
      }
    });

    await this.cache.invalidatePatterns(["hot:transactions:list:*", "hot:transactions:history:*"]);

    return {
      status: "ok",
      transactionStatus: nextStatus,
      freezeCaseId: activeFreeze.id
    };
  }
}
