import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { HealthController } from "../src/modules/health/health.controller";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RedisService } from "../src/modules/cache/redis.service";
import { JobsService } from "../src/modules/jobs/jobs.service";
import { ObservabilityService } from "../src/modules/observability/observability.service";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue(1)
          }
        },
        {
          provide: RedisService,
          useValue: {
            raw: {
              ping: jest.fn().mockResolvedValue("PONG")
            }
          }
        },
        {
          provide: JobsService,
          useValue: {
            getStatusSummary: jest.fn().mockResolvedValue({ queueDepth: 0, alertsOpen: 0, activeBanners: 0 })
          }
        },
        {
          provide: ObservabilityService,
          useValue: {
            recordMetric: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok payload", async () => {
    const server = app.getHttpServer();
    const response = await request(server).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
