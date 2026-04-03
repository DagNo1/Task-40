import { FieldEncryptionService } from "../src/security/crypto/field-encryption.service";

describe("FieldEncryptionService", () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.FIELD_ENCRYPTION_KEY;
      return;
    }
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts roundtrip", () => {
    process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key";
    const service = new FieldEncryptionService();
    const value = "vendor-contact@example.local";
    const encrypted = service.encrypt(value);
    expect(encrypted).not.toEqual(value);
    expect(service.decrypt(encrypted)).toEqual(value);
  });

  it("throws when FIELD_ENCRYPTION_KEY is missing", () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => new FieldEncryptionService()).toThrow("FIELD_ENCRYPTION_KEY is required");
  });
});
