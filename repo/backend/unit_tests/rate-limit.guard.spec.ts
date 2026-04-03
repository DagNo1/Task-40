import { HttpException } from "@nestjs/common";
import { RateLimitGuard } from "../src/modules/rate-limit/rate-limit.guard";

describe("RateLimitGuard", () => {
  it("uses per-user configured limit", async () => {
    const redis = {
      raw: {
        incr: jest.fn().mockResolvedValue(3),
        expire: jest.fn().mockResolvedValue(1)
      }
    } as any;
    const limits = {
      getPerUserLimit: jest.fn().mockResolvedValue(2)
    } as any;
    const guard = new RateLimitGuard(redis, limits);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ auth: { userId: "u1" } }) })
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
  });
});
