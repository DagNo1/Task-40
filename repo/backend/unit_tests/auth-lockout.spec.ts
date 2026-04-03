import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "../src/security/auth/auth.service";

describe("AuthService lockout", () => {
  it("increments failed attempts on bad password", async () => {
    const passwordHash = await bcrypt.hash("ValidPassword123", 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          username: "editor",
          passwordHash,
          mfaEnabled: false,
          failedAttempts: 0,
          lockedUntil: null
        }),
        update: jest.fn()
      },
      $transaction: jest.fn()
    } as any;
    const sessionService = { create: jest.fn() } as any;
    const mfaService = { verifyCode: jest.fn(), generateOpaqueToken: jest.fn() } as any;
    const encryptionService = { decrypt: jest.fn() } as any;

    const service = new AuthService(prisma, sessionService, mfaService, encryptionService);

    await expect(
      service.login({ username: "editor", password: "wrong-password-123" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
