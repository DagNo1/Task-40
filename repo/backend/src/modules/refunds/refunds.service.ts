import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthActor, ensureActorObjectAccess } from "../../common/authz/object-access.policy";
import { HotReadCacheService } from "../cache/hot-read-cache.service";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CreateRefundDto } from "./dto/create-refund.dto";

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly auditLogs: AuditLogsService,
    private readonly cache: HotReadCacheService
  ) {}

  async refund(actor: AuthActor | undefined, transactionId: string, dto: CreateRefundDto) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) {
      throw new NotFoundException("Transaction not found");
    }

    ensureActorObjectAccess(actor, {
      ownerIds: [tx.createdByUserId, tx.approvedByUserId],
      context: "transaction refund",
      allowIfAnyPermission: ["finance.refund", "finance.review"]
    });

    const userId = actor?.userId;
    if (tx.status === "PENDING_APPROVAL") {
      throw new BadRequestException("Cannot refund a charge before approval");
    }
    if (tx.status === "FROZEN") {
      throw new BadRequestException("Cannot refund while transaction is frozen");
    }

    const alreadyRefunded = await this.ledger.getRefundedCents(transactionId);
    const remaining = tx.totalAmountCents - alreadyRefunded;
    if (remaining <= 0) {
      throw new BadRequestException("Transaction has no refundable balance remaining");
    }

    const requested = dto.type === "full" ? remaining : dto.amountCents ?? 0;
    if (requested <= 0) {
      throw new BadRequestException("Refund amount must be positive");
    }
    if (requested > remaining) {
      throw new BadRequestException("Refund exceeds remaining charge amount");
    }

    const storyVersion = await this.prisma.storyVersion.findUnique({ where: { id: dto.storyVersionId } });
    if (!storyVersion) {
      throw new NotFoundException("Specified story version for refund not found");
    }
    if (tx.storyVersionId && tx.storyVersionId !== dto.storyVersionId) {
      throw new BadRequestException("Refund story version must match transaction story version");
    }

    const refundCase = await this.prisma.refundCase.create({
      data: {
        transactionId,
        storyVersionId: dto.storyVersionId,
        amountCents: requested,
        type: dto.type.toUpperCase(),
        reason: dto.note,
        createdByUserId: userId
      }
    });

    const refundedAfter = alreadyRefunded + requested;
    const isFull = refundedAfter === tx.totalAmountCents;
    const nextStatus = isFull ? "REFUNDED_FULL" : "REFUNDED_PARTIAL";
    const explanation = isFull
      ? "Transaction fully refunded; no remaining collectible balance."
      : `Partial refund posted; ${tx.totalAmountCents - refundedAfter} cents remain collectible.`;

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: nextStatus,
        statusExplanation: explanation
      }
    });

    await this.ledger.appendEntry({
      transactionId,
      entryType: "REFUND",
      amountCents: requested * -1,
      createdByUserId: userId,
      metadata: {
        refundCaseId: refundCase.id,
        type: dto.type,
        note: dto.note,
        storyVersionId: dto.storyVersionId
      }
    });

    await this.auditLogs.write({
      userId,
      actionType: "REFUND_APPLIED",
      entityType: "transaction",
      entityId: transactionId,
      notes: dto.note,
      metadata: {
        refundCaseId: refundCase.id,
        amountCents: requested,
        type: dto.type,
        beforeStatus: tx.status,
        afterStatus: nextStatus,
        storyVersionId: dto.storyVersionId
      }
    });

    await this.cache.invalidatePatterns(["hot:transactions:list:*", "hot:transactions:history:*"]);

    return {
      status: "ok",
      refundCaseId: refundCase.id,
      refundedCents: requested,
      remainingCents: tx.totalAmountCents - refundedAfter,
      transactionStatus: nextStatus
    };
  }
}
