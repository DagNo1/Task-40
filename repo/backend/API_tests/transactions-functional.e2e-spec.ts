import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { createHash } from "crypto";
import * as request from "supertest";
import cookieParser = require("cookie-parser");
import { TransactionsV1Controller } from "../src/api/v1/transactions-v1.controller";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { SessionGuard } from "../src/common/guards/session.guard";
import { AuditLogsService } from "../src/modules/audit-logs/audit-logs.service";
import { HotReadCacheService } from "../src/modules/cache/hot-read-cache.service";
import { FreezesService } from "../src/modules/freezes/freezes.service";
import { LedgerService } from "../src/modules/ledger/ledger.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RefundsService } from "../src/modules/refunds/refunds.service";
import { TransactionsService } from "../src/modules/transactions/transactions.service";
import { SessionService } from "../src/security/auth/session.service";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";

describe("Transactions functional API behavior (e2e)", () => {
  let app: INestApplication;

  const sessions = {
    "sid-finance": {
      id: "sid-finance",
      userId: "u-finance",
      roles: ["finance"],
      permissions: ["transactions.read", "finance.review"]
    },
    "sid-read-only": {
      id: "sid-read-only",
      userId: "u-reader",
      roles: ["finance"],
      permissions: ["transactions.read"]
    }
  } as const;

  const csrfBySid: Record<string, string> = {
    "sid-finance": "csrf-finance",
    "sid-read-only": "csrf-read-only"
  };

  const ledgerEntries: Array<{ transactionId: string; amountCents: number }> = [];
  const transactions: Array<{
    id: string;
    reference: string;
    channel: string;
    bundleCount: number;
    unitPriceCents: number;
    totalAmountCents: number;
    currency: string;
    status: string;
    statusExplanation: string;
    storyVersionId: string | null;
    createdByUserId: string | null;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [
    {
      id: "tx-seed-1",
      reference: "TX-SEED-1",
      channel: "prepaid_balance",
      bundleCount: 1,
      unitPriceCents: 2500,
      totalAmountCents: 2500,
      currency: "USD",
      status: "PENDING_APPROVAL",
      statusExplanation: "Seed pending approval",
      storyVersionId: "3f6b1bf8-f5c8-48eb-b015-97fd3516b726",
      createdByUserId: "u-seed",
      approvedByUserId: null,
      approvedAt: null,
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
      updatedAt: new Date("2026-03-30T00:00:00.000Z")
    }
  ];

  const prisma = {
    session: {
      findUnique: jest.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        const token = csrfBySid[id];
        if (!token) {
          return null;
        }
        return {
          id,
          csrfTokenHash: createHash("sha256").update(token).digest("hex")
        };
      })
    },
    storyVersion: {
      findUnique: jest.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        if (id === "3f6b1bf8-f5c8-48eb-b015-97fd3516b726") {
          return { id };
        }
        return null;
      }),
      findMany: jest.fn().mockResolvedValue([])
    },
    transaction: {
      findMany: jest.fn().mockImplementation(async () =>
        transactions
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((tx) => ({ ...tx, refunds: [], freezes: [] }))
      ),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const record = {
          id: `tx-${transactions.length + 1}`,
          reference: String(data.reference),
          channel: String(data.channel),
          bundleCount: Number(data.bundleCount),
          unitPriceCents: Number(data.unitPriceCents),
          totalAmountCents: Number(data.totalAmountCents),
          currency: String(data.currency),
          status: String(data.status),
          statusExplanation: String(data.statusExplanation),
          storyVersionId: (data.storyVersionId as string | null | undefined) ?? null,
          createdByUserId: (data.createdByUserId as string | null | undefined) ?? null,
          approvedByUserId: (data.approvedByUserId as string | null | undefined) ?? null,
          approvedAt: (data.approvedAt as Date | null | undefined) ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        transactions.push(record);
        return record;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
        return transactions.find((tx) => tx.id === id) ?? null;
      }),
      update: jest.fn().mockImplementation(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = transactions.findIndex((tx) => tx.id === id);
        if (index < 0) {
          return null;
        }
        const next = {
          ...transactions[index],
          ...data,
          updatedAt: new Date()
        };
        transactions[index] = next;
        return next;
      })
    },
    fundLedger: { findMany: jest.fn().mockResolvedValue([]) },
    refundCase: { findMany: jest.fn().mockResolvedValue([]) },
    freezeCase: { findMany: jest.fn().mockResolvedValue([]) },
    immutableAuditLog: { findMany: jest.fn().mockResolvedValue([]) }
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsV1Controller],
      providers: [
        TransactionsService,
        { provide: RefundsService, useValue: { refund: jest.fn() } },
        { provide: FreezesService, useValue: { freeze: jest.fn(), release: jest.fn() } },
        {
          provide: SessionService,
          useValue: {
            validateAndRefresh: jest.fn().mockImplementation((sid: string) => sessions[sid as keyof typeof sessions] ?? null)
          }
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: LedgerService,
          useValue: {
            appendEntry: jest.fn().mockImplementation(async (entry: { transactionId: string; amountCents: number }) => {
              ledgerEntries.push(entry);
            }),
            getRefundedCents: jest.fn().mockResolvedValue(0)
          }
        },
        { provide: AuditLogsService, useValue: { write: jest.fn() } },
        {
          provide: HotReadCacheService,
          useValue: {
            getOrLoad: jest.fn().mockImplementation(async (_key: string, loader: () => Promise<unknown>) => loader()),
            invalidatePatterns: jest.fn().mockResolvedValue(undefined)
          }
        },
        Reflector,
        SessionGuard,
        PermissionGuard,
        CsrfGuard
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated list requests", async () => {
    const response = await request(app.getHttpServer()).get("/transactions");
    expect(response.status).toBe(401);
  });

  it("returns current transactions for authorized readers", async () => {
    const response = await request(app.getHttpServer())
      .get("/transactions")
      .set("Cookie", ["sid=sid-finance"]);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
  });

  it("rejects create charge without finance.review permission", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions/charges")
      .set("Cookie", ["sid=sid-read-only"])
      .set("x-csrf-token", "csrf-read-only")
      .send({
        storyVersionId: "3f6b1bf8-f5c8-48eb-b015-97fd3516b726",
        channel: "prepaid_balance"
      });
    expect(response.status).toBe(403);
  });

  it("rejects create charge when required params are missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions/charges")
      .set("Cookie", ["sid=sid-finance"])
      .set("x-csrf-token", "csrf-finance")
      .send({ channel: "prepaid_balance" });
    expect(response.status).toBe(400);
    expect(String(response.body.message)).toContain("storyVersionId");
  });

  it("rejects create charge when parameter format/type is invalid", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions/charges")
      .set("Cookie", ["sid=sid-finance"])
      .set("x-csrf-token", "csrf-finance")
      .send({
        storyVersionId: "not-a-uuid",
        channel: "prepaid_balance",
        bundleCount: 0
      });
    expect(response.status).toBe(400);
    const message = Array.isArray(response.body.message)
      ? response.body.message.join(" | ")
      : String(response.body.message);
    expect(message).toContain("storyVersionId");
  });

  it("updates transaction state before vs after create and approve calls", async () => {
    const server = app.getHttpServer();

    const beforeList = await request(server)
      .get("/transactions")
      .set("Cookie", ["sid=sid-finance"]);
    expect(beforeList.status).toBe(200);
    const beforeCount = beforeList.body.items.length;

    const createResponse = await request(server)
      .post("/transactions/charges")
      .set("Cookie", ["sid=sid-finance"])
      .set("x-csrf-token", "csrf-finance")
      .send({
        storyVersionId: "3f6b1bf8-f5c8-48eb-b015-97fd3516b726",
        channel: "prepaid_balance",
        bundleCount: 2
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe("PENDING_APPROVAL");

    const createdId = createResponse.body.id as string;
    const afterCreateList = await request(server)
      .get("/transactions")
      .set("Cookie", ["sid=sid-finance"]);
    expect(afterCreateList.status).toBe(200);
    expect(afterCreateList.body.items.length).toBe(beforeCount + 1);

    const approveResponse = await request(server)
      .post(`/transactions/${createdId}/approve`)
      .set("Cookie", ["sid=sid-finance"])
      .set("x-csrf-token", "csrf-finance")
      .send({ note: "approve this transaction" });
    expect(approveResponse.status).toBe(201);
    expect(approveResponse.body.status).toBe("APPROVED");

    const afterApproveList = await request(server)
      .get("/transactions")
      .set("Cookie", ["sid=sid-finance"]);
    const updated = afterApproveList.body.items.find((item: { id: string }) => item.id === createdId);
    expect(updated?.status).toBe("APPROVED");
    expect(ledgerEntries.some((entry) => entry.transactionId === createdId)).toBe(true);
  });
});
