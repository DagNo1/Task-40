import { FieldEncryptionService } from "../src/security/crypto/field-encryption.service";
import { SensitiveProfileService } from "../src/modules/users/sensitive-profile.service";

describe("SensitiveProfileService", () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.FIELD_ENCRYPTION_KEY;
      return;
    }
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
  });

  it("stores sensitive fields as ciphertext and decrypts on read", async () => {
    let contactRow: any = null;
    let accountRow: any = null;

    const prisma = {
      vendorContact: {
        findFirst: jest.fn().mockImplementation(() => contactRow),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => {
          contactRow = { id: "vc1", ...data };
          return contactRow;
        }),
        update: jest.fn()
      },
      financialAccount: {
        findFirst: jest.fn().mockImplementation(() => accountRow),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => {
          accountRow = { id: "fa1", ...data };
          return accountRow;
        }),
        update: jest.fn()
      }
    } as any;

    const service = new SensitiveProfileService(prisma, new FieldEncryptionService());

    const result = await service.upsertForUser("u1", {
      email: "vendor@example.local",
      phone: "+1-555-0100",
      accountId: "acct-12345",
      vendorHandle: "wire_vendor"
    });

    expect(contactRow.encryptedEmail).not.toBe("vendor@example.local");
    expect(contactRow.encryptedPhone).not.toBe("+1-555-0100");
    expect(accountRow.encryptedAccountId).not.toBe("acct-12345");
    expect(accountRow.encryptedVendorHandle).not.toBe("wire_vendor");

    expect(result).toEqual({
      contact: { email: "vendor@example.local", phone: "+1-555-0100" },
      account: { accountId: "acct-12345", vendorHandle: "wire_vendor" }
    });
  });
});
