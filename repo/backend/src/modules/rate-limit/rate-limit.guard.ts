import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";
import { RedisService } from "../cache/redis.service";
import { RateLimitService } from "./rate-limit.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly rateLimitService: RateLimitService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: { userId?: string } }>();
    const userId = request.auth?.userId ?? "anonymous";
    const limit = await this.rateLimitService.getPerUserLimit(userId);
    const key = `rate:${userId}`;
    const count = await this.redis.raw.incr(key);

    if (count === 1) {
      await this.redis.raw.expire(key, 60);
    }

    if (count > limit) {
      throw new HttpException(`Rate limit exceeded (${limit} req/min)`, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
