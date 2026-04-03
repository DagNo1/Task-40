import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: false,
      maxRetriesPerRequest: 3
    });
  }

  get raw(): Redis {
    return this.client;
  }

  async setHotRead(key: string, value: string, ttlSeconds = 300): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async getHotRead(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.client.del(...keys);
  }

  async scanKeys(pattern: string): Promise<string[]> {
    let cursor = "0";
    const results: string[] = [];
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = nextCursor;
      results.push(...keys);
    } while (cursor !== "0");
    return results;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
