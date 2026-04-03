import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as request from "supertest";
import { AuthV1Controller } from "../src/api/v1/auth-v1.controller";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { SessionGuard } from "../src/common/guards/session.guard";
import { RedisService } from "../src/modules/cache/redis.service";
import { RateLimitGuard } from "../src/modules/rate-limit/rate-limit.guard";
import { RateLimitService } from "../src/modules/rate-limit/rate-limit.service";
import { AuthService } from "../src/security/auth/auth.service";
import { SessionService } from "../src/security/auth/session.service";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";
import { FieldEncryptionService } from "../src/security/crypto/field-encryption.service";
import { MfaService } from "../src/security/mfa/mfa.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { AuditLogsService } from "../src/modules/audit-logs/audit-logs.service";

describe("AuthV1Controller (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthV1Controller],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              status: "ok",
              sessionId: "s1",
              csrfToken: "csrf",
              user: { id: "u1", username: "admin" }
            })
          }
        },
        { provide: SessionService, useValue: { revoke: jest.fn() } },
        { provide: MfaService, useValue: { generateSecret: jest.fn(), verifyCode: jest.fn() } },
        { provide: FieldEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
        { provide: PrismaService, useValue: { user: { findUniqueOrThrow: jest.fn(), update: jest.fn() } } },
        { provide: AuditLogsService, useValue: { write: jest.fn() } },
        {
          provide: RedisService,
          useValue: {
            raw: {
              incr: jest.fn().mockResolvedValue(1),
              expire: jest.fn().mockResolvedValue(1)
            }
          }
        },
        { provide: RateLimitService, useValue: { getPerUserLimit: jest.fn().mockResolvedValue(60) } },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(undefined)
          }
        },
        RateLimitGuard,
        SessionGuard,
        PermissionGuard,
        { provide: CsrfGuard, useValue: { canActivate: () => true } }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /auth/login returns auth payload", async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .post("/auth/login")
      .send({ username: "admin", password: "ChangeMeNow123" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("ok");
    expect(response.body.csrfToken).toBe("csrf");
  });
});
