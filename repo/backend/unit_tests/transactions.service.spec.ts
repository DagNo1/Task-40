import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TransactionsService } from "../src/modules/transactions/transactions.service";

describe("TransactionsService", () => {
  it("rejects approving non-pending transaction", async () => {
    const service = new TransactionsService(
      {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({ id: "tx1", status: "APPROVED" })
        }
      } as any,
      { appendEntry: jest.fn() } as any,
      { write: jest.fn() } as any,
      { getOrLoad: jest.fn((_key, loader) => loader()), invalidatePatterns: jest.fn() } as any
    );

    await expect(service.approveCharge("u1", "tx1", { note: "approve note" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects transaction history reads without read/audit permissions", async () => {
    const service = new TransactionsService(
      {
        transaction: {
          findUnique: jest.fn().mockResolvedValue({
            id: "tx1",
            status: "APPROVED",
            createdByUserId: "owner-1",
            approvedByUserId: null
          })
        },
        fundLedger: { findMany: jest.fn().mockResolvedValue([]) },
        refundCase: { findMany: jest.fn().mockResolvedValue([]) },
        freezeCase: { findMany: jest.fn().mockResolvedValue([]) },
        immutableAuditLog: { findMany: jest.fn().mockResolvedValue([]) }
      } as any,
      { appendEntry: jest.fn() } as any,
      { write: jest.fn() } as any,
      { getOrLoad: jest.fn((_key, loader) => loader()), invalidatePatterns: jest.fn() } as any
    );

    await expect(service.history({ userId: "other-user", permissions: [] }, "tx1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
