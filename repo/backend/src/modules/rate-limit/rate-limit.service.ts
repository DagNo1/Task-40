import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../cache/redis.service";

@Injectable()
export class RateLimitService {
  private readonly envDefaultLimit = Number(process.env.DEFAULT_RATE_LIMIT_RPM ?? 60);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  async getPerUserLimit(userId?: string): Promise<number> {
    const defaultLimit = await this.getDefaultLimit();

    if (!userId || userId === "anonymous") {
      return defaultLimit;
    }

    const cacheKey = `rate-limit-config:${userId}`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      const parsed = Number.parseInt(cached, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
    }

    const row = await this.prisma.userRateLimit.findUnique({ where: { userId } });
    const limit = row?.requestsPerMinute ?? defaultLimit;
    await this.redis.raw.set(cacheKey, `${limit}`, "EX", 300);
    return limit;
  }

  private async getDefaultLimit(): Promise<number> {
    const cached = await this.redis.raw.get("rate-limit-config:default");
    if (cached) {
      const parsed = Number.parseInt(cached, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    const threshold = await this.prisma.systemThresholdConfig.findUnique({
      where: { key: "DEFAULT_RATE_LIMIT_RPM" }
    });
    const limit = threshold?.value ? Number.parseInt(threshold.value, 10) : this.envDefaultLimit;
    const normalized = Number.isFinite(limit) && limit > 0 ? limit : this.envDefaultLimit;
    await this.redis.raw.set("rate-limit-config:default", `${normalized}`, "EX", 300);
    return normalized;
  }

  async upsertPerUserLimit(userId: string, requestsPerMinute: number, updatedByUserId?: string) {
    const row = await this.prisma.userRateLimit.upsert({
      where: { userId },
      update: {
        requestsPerMinute,
        updatedByUserId
      },
      create: {
        userId,
        requestsPerMinute,
        updatedByUserId
      }
    });

    await this.redis.raw.set(`rate-limit-config:${userId}`, `${requestsPerMinute}`, "EX", 300);
    return row;
  }
}
