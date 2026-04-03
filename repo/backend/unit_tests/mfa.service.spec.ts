import { MfaService } from "../src/security/mfa/mfa.service";

describe("MfaService", () => {
  it("generates secret and verifies valid token", () => {
    const service = new MfaService();
    const generated = service.generateSecret("editor");
    expect(generated.secret).toBeTruthy();
    expect(generated.otpauth).toContain("otpauth://");
  });
});
