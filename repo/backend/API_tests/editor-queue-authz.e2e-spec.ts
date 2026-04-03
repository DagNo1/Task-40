import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { createHash } from "crypto";
import * as request from "supertest";
import cookieParser = require("cookie-parser");
import { EditorQueueV1Controller } from "../src/api/v1/editor-queue-v1.controller";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { SessionGuard } from "../src/common/guards/session.guard";
import { AuditLogsService } from "../src/modules/audit-logs/audit-logs.service";
import { CleansingService } from "../src/modules/cleansing/cleansing.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { MergeService } from "../src/modules/merge/merge.service";
import { SessionService } from "../src/security/auth/session.service";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";

describe("Editor queue object authorization (e2e)", () => {
  let app: INestApplication;

  const sessions = {
    "sid-reviewer": {
      id: "sid-reviewer",
      userId: "reviewer-user",
      roles: ["editor"],
      permissions: ["stories.review"]
    },
    "sid-owner-review": {
      id: "sid-owner-review",
      userId: "owner-user",
      roles: ["editor"],
      permissions: ["stories.review"]
    },
    "sid-no-review": {
      id: "sid-no-review",
      userId: "limited-user",
      roles: ["viewer"],
      permissions: ["transactions.read"]
    }
  } as const;

  const csrfBySid: Record<string, string> = {
    "sid-reviewer": "csrf-reviewer",
    "sid-owner-review": "csrf-owner-review",
    "sid-no-review": "csrf-no-review"
  };

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
      findUnique: jest.fn().mockResolvedValue({
        id: "v-1",
        storyId: "s-1",
        versionNumber: 3,
        title: "Title",
        body: "Body",
        rawUrl: "https://example.com/story",
        canonicalUrl: "https://example.com/story",
        source: "wire",
        sourceExternalId: null,
        publishedAt: null,
        contentHash: "hash",
        simhash: "simhash",
        minhashSignature: "1,2"
      }),
      findFirst: jest
        .fn()
        .mockImplementation(({ where: { id } }: { where: { id: string } }) => {
          if (id === "v-1") {
            return {
              id: "v-1",
              storyId: "s-1",
              title: "Title A",
              body: "Body A",
              canonicalUrl: "https://example.com/a",
              source: "wire",
              sourceExternalId: "ext-a"
            };
          }
          if (id === "v-2") {
            return {
              id: "v-2",
              storyId: "s-1",
              title: "Title B",
              body: "Body B",
              canonicalUrl: "https://example.com/b",
              source: "wire",
              sourceExternalId: "ext-b"
            };
          }
          return null;
        })
    },
    story: {
      findUnique: jest.fn().mockResolvedValue({ id: "s-1" })
    },
    cleansingEvent: {
      findFirst: jest
        .fn()
        .mockImplementation(
          ({ where: { userId, storyVersionId } }: { where: { userId: string; storyVersionId: string } }) => {
            if (userId === "owner-user" && (storyVersionId === "v-1" || storyVersionId === "v-2")) {
              return { id: "ce-owner" };
            }
            return null;
          }
        )
    }
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EditorQueueV1Controller],
      providers: [
        MergeService,
        {
          provide: SessionService,
          useValue: {
            validateAndRefresh: jest
              .fn()
              .mockImplementation((sid: string) => sessions[sid as keyof typeof sessions] ?? null)
          }
        },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { write: jest.fn() } },
        { provide: CleansingService, useValue: { cleanse: jest.fn() } },
        Reflector,
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

  it("POST /editor-queue/merge returns 401 when unauthenticated", async () => {
    const response = await request(app.getHttpServer()).post("/editor-queue/merge").send({
      incomingVersionId: "v-1",
      strategy: "keep_both",
      note: "valid note"
    });
    expect(response.status).toBe(401);
  });

  it("POST /editor-queue/merge returns 403 when route permission is missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/editor-queue/merge")
      .set("Cookie", ["sid=sid-no-review"])
      .set("x-csrf-token", "csrf-no-review")
      .send({ incomingVersionId: "v-1", strategy: "keep_both", note: "valid note" });
    expect(response.status).toBe(403);
  });

  it("POST /editor-queue/merge returns 403 for object-level unauthorized actor", async () => {
    const response = await request(app.getHttpServer())
      .post("/editor-queue/merge")
      .set("Cookie", ["sid=sid-reviewer"])
      .set("x-csrf-token", "csrf-reviewer")
      .send({ incomingVersionId: "v-1", strategy: "keep_both", note: "valid note" });
    expect(response.status).toBe(403);
  });

  it("POST /editor-queue/repair/:versionId returns 403 for object-level unauthorized actor", async () => {
    const response = await request(app.getHttpServer())
      .post("/editor-queue/repair/v-1")
      .set("Cookie", ["sid=sid-reviewer"])
      .set("x-csrf-token", "csrf-reviewer")
      .send({ note: "valid note" });
    expect(response.status).toBe(403);
  });

  it("GET /editor-queue/:storyId/diff returns 401 when unauthenticated", async () => {
    const response = await request(app.getHttpServer()).get(
      "/editor-queue/s-1/diff?leftVersionId=v-1&rightVersionId=v-2"
    );
    expect(response.status).toBe(401);
  });

  it("GET /editor-queue/:storyId/diff returns 403 when route permission is missing", async () => {
    const response = await request(app.getHttpServer())
      .get("/editor-queue/s-1/diff?leftVersionId=v-1&rightVersionId=v-2")
      .set("Cookie", ["sid=sid-no-review"]);
    expect(response.status).toBe(403);
  });

  it("GET /editor-queue/:storyId/diff returns 403 for object-level unauthorized actor", async () => {
    const response = await request(app.getHttpServer())
      .get("/editor-queue/s-1/diff?leftVersionId=v-1&rightVersionId=v-2")
      .set("Cookie", ["sid=sid-reviewer"]);
    expect(response.status).toBe(403);
  });

  it("GET /editor-queue/:storyId/diff returns 200 for authorized actor", async () => {
    const response = await request(app.getHttpServer())
      .get("/editor-queue/s-1/diff?leftVersionId=v-1&rightVersionId=v-2")
      .set("Cookie", ["sid=sid-owner-review"]);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.fields)).toBe(true);
    expect(response.body.fields.length).toBeGreaterThan(0);
  });
});
