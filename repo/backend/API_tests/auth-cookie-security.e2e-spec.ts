import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as request from "supertest";
import { AuthV1Controller } from "../src/api/v1/auth-v1.controller";
import { AuthV2Controller } from "../src/api/v2/auth-v2.controller";
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

type ControllerType = typeof AuthV1Controller | typeof AuthV2Controller;

async function buildApp(controller: ControllerType): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
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
      { provide: SessionService, useValue: { revoke: jest.fn(), rotateCsrfTokenHash: jest.fn() } },
      { provide: MfaService, useValue: { generateSecret: jest.fn(), verifyCode: jest.fn(), generateOpaqueToken: jest.fn() } },
      { provide: FieldEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
      { provide: PrismaService, useValue: { user: { findUniqueOrThrow: jest.fn(), update: jest.fn() }, session: { findUnique: jest.fn() } } },
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
      { provide: CsrfGuard, useValue: { canActivate: () => true } }
    ]
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function expectCookiePolicy(controller: ControllerType, env: { nodeEnv: string; secure?: string }, shouldBeSecure: boolean) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecure = process.env.SESSION_COOKIE_SECURE;
  const previousSameSite = process.env.SESSION_COOKIE_SAMESITE;
  const previousLocal = process.env.SESSION_COOKIE_LOCAL_DEV;

  process.env.NODE_ENV = env.nodeEnv;
  process.env.SESSION_COOKIE_SAMESITE = "strict";
  delete process.env.SESSION_COOKIE_LOCAL_DEV;
  if (env.secure === undefined) {
    delete process.env.SESSION_COOKIE_SECURE;
  } else {
    process.env.SESSION_COOKIE_SECURE = env.secure;
  }

  const app = await buildApp(controller);
  const response = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ username: "admin", password: "ChangeMeNow123" });

  const setCookie = response.headers["set-cookie"]?.[0] ?? "";
  expect(response.status).toBe(201);
  expect(setCookie).toContain("sid=s1");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Strict");
  if (shouldBeSecure) {
    expect(setCookie).toContain("Secure");
  } else {
    expect(setCookie).not.toContain("Secure");
  }

  await app.close();

  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  if (previousSecure === undefined) {
    delete process.env.SESSION_COOKIE_SECURE;
  } else {
    process.env.SESSION_COOKIE_SECURE = previousSecure;
  }
  if (previousSameSite === undefined) {
    delete process.env.SESSION_COOKIE_SAMESITE;
  } else {
    process.env.SESSION_COOKIE_SAMESITE = previousSameSite;
  }
  if (previousLocal === undefined) {
    delete process.env.SESSION_COOKIE_LOCAL_DEV;
  } else {
    process.env.SESSION_COOKIE_LOCAL_DEV = previousLocal;
  }
}

describe("Auth cookie policy (e2e)", () => {
  it("defaults to non-secure in local development for v1", async () => {
    await expectCookiePolicy(AuthV1Controller, { nodeEnv: "development" }, false);
  });

  it("defaults to secure outside local development for v1", async () => {
    await expectCookiePolicy(AuthV1Controller, { nodeEnv: "production" }, true);
  });

  it("respects secure override for v1", async () => {
    await expectCookiePolicy(AuthV1Controller, { nodeEnv: "development", secure: "true" }, true);
  });

  it("defaults to secure outside local development for v2", async () => {
    await expectCookiePolicy(AuthV2Controller, { nodeEnv: "production" }, true);
  });
});
