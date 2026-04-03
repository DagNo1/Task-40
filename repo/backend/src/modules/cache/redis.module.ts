import { Global, Module } from "@nestjs/common";
import { HotReadCacheService } from "./hot-read-cache.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [RedisService, HotReadCacheService],
  exports: [RedisService, HotReadCacheService]
})
export class RedisModule {}
