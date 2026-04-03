import { Injectable } from "@nestjs/common";
import { RedisService } from "./redis.service";

@Injectable()
export class HotReadCacheService {
  constructor(private readonly redis: RedisService) {}

  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    try {
      const cached = await this.redis.getHotRead(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      return loader();
    }

    const value = await loader();
    try {
      await this.redis.setHotRead(key, JSON.stringify(value), ttlSeconds);
    } catch {
      return value;
    }
    return value;
  }

  async invalidatePatterns(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        const keys = await this.redis.scanKeys(pattern);
        await this.redis.delMany(keys);
      } catch {
        continue;
      }
    }
  }
}
