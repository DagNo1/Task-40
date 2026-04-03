import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { RedisService } from "../../modules/cache/redis.service";

@Injectable()
export class CsrfService {
  constructor(private readonly redis: RedisService) {}

  async issueToken(sessionId: string): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const hash = this.hashToken(token);
    await this.redis.raw.set(`csrf:${sessionId}`, hash, "EX", 12 * 60 * 60);
    return token;
  }

  async validateToken(sessionId: string, token: string): Promise<boolean> {
    const expected = await this.redis.raw.get(`csrf:${sessionId}`);
    if (!expected) {
      return false;
    }
    return expected === this.hashToken(token);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
