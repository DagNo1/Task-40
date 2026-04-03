import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { createHash } from "crypto";
import * as request from "supertest";
import cookieParser = require("cookie-parser");
import { AuthV1Controller } from "../src/api/v1/auth-v1.controller";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { SessionGuard } from "../src/common/guards/session.guard";
import { RedisService } from "../src/modules/cache/redis.service";
import { AuditLogsService } from "../src/modules/audit-logs/audit-logs.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RateLimitGuard } from "../src/modules/rate-limit/rate-limit.guard";
import { RateLimitService } from "../src/modules/rate-limit/rate-limit.service";
import { AuthService } from "../src/security/auth/auth.service";
import { SessionService } from "../src/security/auth/session.service";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";
import { FieldEncryptionService } from "../src/security/crypto/field-encryption.service";
import { MfaService } from "../src/security/mfa/mfa.service";

describe("Auth session guards (e2e)", () => {
  let app: INestApplication;

  const sessionServiceMock = {
    validateAndRefresh: jest.fn().mockImplementation((sid: string) => {
      if (sid !== "sid-ok") {
        return null;
      }
      return {
        id: "sid-ok",
        userId: "u1",
        roles: ["admin"],
        permissions: ["admin.manage", "stories.review"]
      };
    }),
    revoke: jest.fn().mockResolvedValue(undefined),
    rotateCsrfTokenHash: jest.fn().mockResolvedValue(undefined)
  };

  const csrfToken = "csrf-ok";
  const csrfHash = createHash("sha256").update(csrfToken).digest("hex");

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthV1Controller],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn()
          }
        },
        { provide: SessionService, useValue: sessionServiceMock },
        {
          provide: MfaService,
          useValue: { generateSecret: jest.fn(), verifyCode: jest.fn(), generateOpaqueToken: jest.fn().mockReturnValue("csrf-rotated") }
        },
        { provide: FieldEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            session: {
              findUnique: jest.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
                if (id !== "sid-ok") {
                  return null;
                }
                return { id: "sid-ok", csrfTokenHash: csrfHash };
              })
            },
            user: {
              findUniqueOrThrow: jest.fn().mockResolvedValue({ username: "admin", mfaEnabled: false }),
              update: jest.fn()
            }
          }
        },
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
        Reflector,
        RateLimitGuard,
        SessionGuard,
        PermissionGuard,
        CsrfGuard
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /auth/logout rejects missing csrf token with real session and csrf guards", async () => {
    const response = await request(app.getHttpServer()).post("/auth/logout").set("Cookie", ["sid=sid-ok"]);
    expect(response.status).toBe(403);
  });

  it("GET /auth/csrf rejects unauthenticated requests", async () => {
    const response = await request(app.getHttpServer()).get("/auth/csrf");
    expect(response.status).toBe(401);
  });

  it("GET /auth/csrf rotates token hash for authenticated sessions", async () => {
    const response = await request(app.getHttpServer()).get("/auth/csrf").set("Cookie", ["sid=sid-ok"]);
    expect(response.status).toBe(200);
    expect(response.body.csrfToken).toBe("csrf-rotated");
    expect(sessionServiceMock.rotateCsrfTokenHash).toHaveBeenCalled();
  });

  it("POST /auth/logout succeeds with valid session cookie and csrf token", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", ["sid=sid-ok"])
      .set("x-csrf-token", csrfToken);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(sessionServiceMock.revoke).toHaveBeenCalledWith("sid-ok");
  });
});
