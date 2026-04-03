import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.FIELD_ENCRYPTION_KEY;
    if (!raw || raw.trim().length === 0) {
      throw new Error("FIELD_ENCRYPTION_KEY is required for field encryption");
    }
    this.key = createHash("sha256").update(raw).digest();
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(cipherText: string): string {
    const [ivHex, tagHex, payloadHex] = cipherText.split(":");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadHex, "hex")),
      decipher.final()
    ]);
    return decrypted.toString("utf8");
  }
}
