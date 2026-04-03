import { SessionService } from "../src/security/auth/session.service";

describe("SessionService", () => {
  it("returns null when session is expired by idle timeout", async () => {
    const now = Date.now();
    const service = new SessionService({
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "s1",
          userId: "u1",
          revokedAt: null,
          expiresAt: new Date(now - 1000),
          absoluteExpireAt: new Date(now + 10000),
          user: { userRoles: [] }
        }),
        delete: jest.fn(),
        update: jest.fn()
      }
    } as any);

    const result = await service.validateAndRefresh("s1");
    expect(result).toBeNull();
  });

  it("returns null when session hits absolute timeout", async () => {
    const now = Date.now();
    const service = new SessionService({
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "s1",
          userId: "u1",
          revokedAt: null,
          expiresAt: new Date(now + 10000),
          absoluteExpireAt: new Date(now - 1000),
          user: { userRoles: [] }
        }),
        delete: jest.fn(),
        update: jest.fn()
      }
    } as any);

    const result = await service.validateAndRefresh("s1");
    expect(result).toBeNull();
  });
});
