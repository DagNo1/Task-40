import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import cookieParser = require("cookie-parser");
import { ReportsV1Controller } from "../src/api/v1/reports-v1.controller";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { SessionGuard } from "../src/common/guards/session.guard";
import { ReportsService } from "../src/modules/reports/reports.service";
import { SessionService } from "../src/security/auth/session.service";

describe("ReportsV1Controller (e2e)", () => {
  let app: INestApplication;

  const sessions = {
    "sid-audit": {
      id: "sid-audit",
      userId: "u-audit",
      roles: ["auditor"],
      permissions: ["audit.read"]
    },
    "sid-no-audit": {
      id: "sid-no-audit",
      userId: "u-reader",
      roles: ["finance"],
      permissions: ["transactions.read"]
    }
  } as const;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsV1Controller],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            searchAuditLogs: jest.fn().mockResolvedValue([
              {
                id: "a1",
                createdAt: "2026-03-28T00:00:00.000Z",
                userId: "u1",
                actionType: "MERGE_APPLIED",
                entityType: "story",
                entityId: "s1",
                notes: "note"
              }
            ]),
            toCsv: jest.fn().mockReturnValue("id,actionType\na1,MERGE_APPLIED")
          }
        },
        {
          provide: SessionService,
          useValue: {
            validateAndRefresh: jest.fn().mockImplementation((sid: string) => sessions[sid as keyof typeof sessions] ?? null)
          }
        },
        SessionGuard,
        PermissionGuard
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /reports/audit rejects unauthenticated access", async () => {
    const server = app.getHttpServer();
    const response = await request(server).get("/reports/audit");
    expect(response.status).toBe(401);
  });

  it("GET /reports/audit rejects insufficient route permissions", async () => {
    const server = app.getHttpServer();
    const response = await request(server).get("/reports/audit").set("Cookie", ["sid=sid-no-audit"]);
    expect(response.status).toBe(403);
  });

  it("GET /reports/audit rejects malformed MM/DD/YYYY", async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .get("/reports/audit?from=2026-03-28")
      .set("Cookie", ["sid=sid-audit"]);
    expect(response.status).toBe(400);
  });

  it("GET /reports/audit returns filtered list payload", async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .get("/reports/audit?from=03/28/2026&to=03/29/2026")
      .set("Cookie", ["sid=sid-audit"]);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items[0].actionType).toBe("MERGE_APPLIED");
  });
});
