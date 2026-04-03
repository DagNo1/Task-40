import { Injectable } from "@nestjs/common";
import { authenticator } from "otplib";
import { randomBytes } from "crypto";

@Injectable()
export class MfaService {
  generateSecret(username: string): { secret: string; otpauth: string } {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(username, "SentinelDesk", secret);
    return { secret, otpauth };
  }

  verifyCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  generateOpaqueToken(): string {
    return randomBytes(24).toString("hex");
  }
}
