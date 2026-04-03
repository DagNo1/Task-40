import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RefundsService } from "../src/modules/refunds/refunds.service";

describe("RefundsService", () => {
  it("rejects over-refund requests", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tx1",
          status: "APPROVED",
          totalAmountCents: 2500,
          createdByUserId: "u1",
          approvedByUserId: null
        })
      },
      storyVersion: { findUnique: jest.fn().mockResolvedValue({ id: "5f4d4f20-6192-4cbf-ab87-2ba3067a6abc" }) }
    } as any;
    const ledger = { getRefundedCents: jest.fn().mockResolvedValue(2400) } as any;
    const service = new RefundsService(
      prisma,
      ledger,
      { write: jest.fn() } as any,
      { invalidatePatterns: jest.fn() } as any
    );

    await expect(
      service.refund({ userId: "u1" }, "tx1", {
        type: "partial",
        amountCents: 200,
        storyVersionId: "5f4d4f20-6192-4cbf-ab87-2ba3067a6abc",
        note: "too much refund"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects refund when caller is outside object scope", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tx1",
          status: "APPROVED",
          totalAmountCents: 2500,
          createdByUserId: "owner-1",
          approvedByUserId: null
        })
      }
    } as any;
    const service = new RefundsService(
      prisma,
      { getRefundedCents: jest.fn() } as any,
      { write: jest.fn() } as any,
      { invalidatePatterns: jest.fn() } as any
    );

    await expect(
      service.refund(
        { userId: "other-user" },
        "tx1",
        {
          type: "partial",
          amountCents: 1,
          storyVersionId: "5f4d4f20-6192-4cbf-ab87-2ba3067a6abc",
          note: "scope test"
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
