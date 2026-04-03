import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FreezesService } from "../src/modules/freezes/freezes.service";

describe("FreezesService", () => {
  it("requires frozen state before release", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tx1",
          status: "APPROVED",
          createdByUserId: "auditor",
          approvedByUserId: null
        })
      }
    } as any;
    const service = new FreezesService(
      prisma,
      { appendEntry: jest.fn() } as any,
      { write: jest.fn() } as any,
      { invalidatePatterns: jest.fn() } as any
    );

    await expect(
      service.release({ userId: "auditor" }, "tx1", {
        note: "release note"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects freeze release when caller is outside object scope", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tx1",
          status: "FROZEN",
          createdByUserId: "owner",
          approvedByUserId: null
        })
      }
    } as any;
    const service = new FreezesService(
      prisma,
      { appendEntry: jest.fn() } as any,
      { write: jest.fn() } as any,
      { invalidatePatterns: jest.fn() } as any
    );

    await expect(
      service.release({ userId: "other-user" }, "tx1", {
        note: "release note"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects freeze when caller is outside object scope", async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "tx1",
          status: "APPROVED",
          createdByUserId: "owner",
          approvedByUserId: null
        })
      }
    } as any;
    const service = new FreezesService(
      prisma,
      { appendEntry: jest.fn() } as any,
      { write: jest.fn() } as any,
      { invalidatePatterns: jest.fn() } as any
    );

    await expect(
      service.freeze({ userId: "other-user" }, "tx1", {
        note: "freeze note"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
