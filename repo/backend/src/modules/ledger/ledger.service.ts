import { Injectable } from "@nestjs/common";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async appendEntry(input: {
    transactionId: string;
    entryType: "CHARGE" | "REFUND" | "FREEZE" | "RELEASE";
    amountCents: number;
    createdByUserId?: string;
    metadata?: InputJsonValue;
  }) {
    const latest = await this.prisma.fundLedger.findFirst({
      where: { transactionId: input.transactionId },
      orderBy: { createdAt: "desc" }
    });
    const netBefore = latest?.netAmountCents ?? 0;
    const netAfter = netBefore + input.amountCents;

    return this.prisma.fundLedger.create({
      data: {
        transactionId: input.transactionId,
        entryType: input.entryType,
        amountCents: input.amountCents,
        netAmountCents: netAfter,
        createdByUserId: input.createdByUserId,
        metadata: input.metadata
      }
    });
  }

  async getRefundedCents(transactionId: string): Promise<number> {
    const rows = await this.prisma.refundCase.findMany({
      where: { transactionId },
      select: { amountCents: true }
    });
    return rows.reduce((sum: number, row: { amountCents: number }) => sum + row.amountCents, 0);
  }
}
