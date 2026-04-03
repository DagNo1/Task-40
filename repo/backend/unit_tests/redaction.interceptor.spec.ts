import { lastValueFrom, of } from "rxjs";
import { RedactionInterceptor } from "../src/common/interceptors/redaction.interceptor";

describe("RedactionInterceptor", () => {
  it("masks sensitive operation fields for non-admin roles", async () => {
    const interceptor = new RedactionInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: { permissions: ["stories.review"] } })
      })
    } as any;

    const next = {
      handle: () =>
        of({
          actor: "u1",
          beforeRef: { versionId: "v1" },
          sourceExternalId: "ext",
          passwordHash: "abc"
        })
    } as any;

    const result = (await lastValueFrom(interceptor.intercept(context, next))) as Record<string, unknown>;
    expect(result.actor).toBe("[MASKED_BY_ROLE]");
    expect(result.beforeRef).toBe("[MASKED_BY_ROLE]");
    expect(result.passwordHash).toBe("[REDACTED]");
  });
});
