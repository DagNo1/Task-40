import { createHash } from "crypto";
import { ExecutionContext } from "@nestjs/common";
import { CsrfGuard } from "../src/security/csrf/csrf.guard";

describe("CsrfGuard", () => {
  it("rejects invalid token", async () => {
    const guard = new CsrfGuard({
      session: {
        findUnique: jest.fn().mockResolvedValue({ csrfTokenHash: "abc" })
      }
    } as any);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          cookies: { sid: "s1" },
          headers: { "x-csrf-token": "invalid" }
        })
      })
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeTruthy();
  });

  it("accepts valid token", async () => {
    const token = "valid-token";
    const guard = new CsrfGuard({
      session: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ csrfTokenHash: createHash("sha256").update(token).digest("hex") })
      }
    } as any);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          cookies: { sid: "s1" },
          headers: { "x-csrf-token": token }
        })
      })
    } as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
