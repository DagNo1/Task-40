import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash } from "crypto";
import * as request from "supertest";
import cookieParser = require("cookie-parser");
import { ProfileV1Controller } from "../src/api/v1/profile-v1.controller";
import { SessionGuard } from "../src/common/guards/session.guard";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { SensitiveProfileService } from "../src/modules/users/sensitive-profile.service";
import { SessionService } from "../src/security/auth/session.service";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";
import { FieldEncryptionService } from "../src/security/crypto/field-encryption.service";

describe("Sensitive profile encryption (e2e)", () => {
  let app: INestApplication;

  const rows = {
    u1: {
      contact: null as any,
      account: null as any
    },
    u2: {
      contact: null as any,
      account: null as any
    }
  };

  const sessionServiceMock = {
    validateAndRefresh: jest.fn().mockImplementation((sid: string) => {
      if (sid === "sid-user") {
        return { id: sid, userId: "u1", roles: ["editor"], permissions: ["stories.review"] };
      }
      if (sid === "sid-admin") {
        return { id: sid, userId: "u1", roles: ["admin"], permissions: ["admin.manage"] };
      }
      return null;
    })
  };

  const csrfToken = "csrf-ok";
  const csrfHash = createHash("sha256").update(csrfToken).digest("hex");

  beforeAll(async () => {
    process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key";

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileV1Controller],
      providers: [
        SensitiveProfileService,
        SessionGuard,
        CsrfGuard,
        FieldEncryptionService,
        { provide: SessionService, useValue: sessionServiceMock },
        {
          provide: PrismaService,
          useValue: {
            session: {
              findUnique: jest.fn().mockResolvedValue({ id: "sid-user", csrfTokenHash: csrfHash })
            },
            vendorContact: {
              findFirst: jest.fn().mockImplementation(({ where: { userId } }: { where: { userId: "u1" | "u2" } }) => rows[userId].contact),
              create: jest.fn().mockImplementation(({ data }: { data: any }) => {
                rows[data.userId as "u1" | "u2"].contact = { id: `vc-${data.userId}`, ...data };
                return rows[data.userId as "u1" | "u2"].contact;
              }),
              update: jest.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: any }) => {
                const key = id.includes("u2") ? "u2" : "u1";
                rows[key].contact = { ...rows[key].contact, ...data };
                return rows[key].contact;
              })
            },
            financialAccount: {
              findFirst: jest.fn().mockImplementation(({ where: { userId } }: { where: { userId: "u1" | "u2" } }) => rows[userId].account),
              create: jest.fn().mockImplementation(({ data }: { data: any }) => {
                rows[data.userId as "u1" | "u2"].account = { id: `fa-${data.userId}`, ...data };
                return rows[data.userId as "u1" | "u2"].account;
              }),
              update: jest.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: any }) => {
                const key = id.includes("u2") ? "u2" : "u1";
                rows[key].account = { ...rows[key].account, ...data };
                return rows[key].account;
              })
            }
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("blocks unauthenticated access", async () => {
    const response = await request(app.getHttpServer()).get("/profile/sensitive");
    expect(response.status).toBe(401);
  });

  it("encrypts at rest and decrypts on authorized read", async () => {
    const saveResponse = await request(app.getHttpServer())
      .put("/profile/sensitive")
      .set("Cookie", ["sid=sid-user"])
      .set("x-csrf-token", csrfToken)
      .send({
        email: "finance-contact@example.local",
        phone: "+1-555-0199",
        accountId: "acct-9000",
        vendorHandle: "wire-feed"
      });

    expect(saveResponse.status).toBe(200);
    expect(rows.u1.contact.encryptedEmail).not.toBe("finance-contact@example.local");
    expect(rows.u1.account.encryptedAccountId).not.toBe("acct-9000");

    const readResponse = await request(app.getHttpServer())
      .get("/profile/sensitive")
      .set("Cookie", ["sid=sid-user"]);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toEqual({
      contact: {
        email: "finance-contact@example.local",
        phone: "+1-555-0199"
      },
      account: {
        accountId: "acct-9000",
        vendorHandle: "wire-feed"
      }
    });
    expect(JSON.stringify(readResponse.body)).not.toContain("encryptedEmail");
    expect(JSON.stringify(readResponse.body)).not.toContain("encryptedAccountId");
  });

  it("prevents non-admin users from reading another user's sensitive data", async () => {
    rows.u2.contact = {
      id: "vc-u2",
      userId: "u2",
      encryptedEmail: rows.u1.contact.encryptedEmail,
      encryptedPhone: rows.u1.contact.encryptedPhone
    };
    rows.u2.account = {
      id: "fa-u2",
      userId: "u2",
      encryptedAccountId: rows.u1.account.encryptedAccountId,
      encryptedVendorHandle: rows.u1.account.encryptedVendorHandle
    };

    const response = await request(app.getHttpServer())
      .get("/profile/sensitive")
      .query({ userId: "u2" })
      .set("Cookie", ["sid=sid-user"]);

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain("finance-contact@example.local");
    expect(JSON.stringify(response.body)).not.toContain("acct-9000");
  });
});
