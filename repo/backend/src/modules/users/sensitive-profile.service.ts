import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FieldEncryptionService } from "../../security/crypto/field-encryption.service";
import { UpdateSensitiveProfileDto } from "./dto/update-sensitive-profile.dto";

export type SensitiveProfilePayload = {
  contact: {
    email: string;
    phone: string;
  } | null;
  account: {
    accountId: string;
    vendorHandle: string;
  } | null;
};

@Injectable()
export class SensitiveProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService
  ) {}

  async readForUser(userId: string): Promise<SensitiveProfilePayload> {
    const [contact, account] = await Promise.all([
      this.prisma.vendorContact.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      this.prisma.financialAccount.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
    ]);

    return {
      contact: contact
        ? {
            email: this.encryption.decrypt(contact.encryptedEmail),
            phone: this.encryption.decrypt(contact.encryptedPhone)
          }
        : null,
      account: account
        ? {
            accountId: this.encryption.decrypt(account.encryptedAccountId),
            vendorHandle: this.encryption.decrypt(account.encryptedVendorHandle)
          }
        : null
    };
  }

  async upsertForUser(userId: string, payload: UpdateSensitiveProfileDto): Promise<SensitiveProfilePayload> {
    const email = this.normalizeOptional("email", payload.email);
    const phone = this.normalizeOptional("phone", payload.phone);
    const accountId = this.normalizeOptional("accountId", payload.accountId);
    const vendorHandle = this.normalizeOptional("vendorHandle", payload.vendorHandle);

    if (email !== undefined || phone !== undefined) {
      const existingContact = await this.prisma.vendorContact.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });

      if (!existingContact) {
        if (email === undefined || phone === undefined) {
          throw new BadRequestException("Both email and phone are required to create contact details");
        }
        await this.prisma.vendorContact.create({
          data: {
            userId,
            encryptedEmail: this.encryption.encrypt(email),
            encryptedPhone: this.encryption.encrypt(phone)
          }
        });
      } else {
        const data: { encryptedEmail?: string; encryptedPhone?: string } = {};
        if (email !== undefined) {
          data.encryptedEmail = this.encryption.encrypt(email);
        }
        if (phone !== undefined) {
          data.encryptedPhone = this.encryption.encrypt(phone);
        }
        if (Object.keys(data).length > 0) {
          await this.prisma.vendorContact.update({ where: { id: existingContact.id }, data });
        }
      }
    }

    if (accountId !== undefined || vendorHandle !== undefined) {
      const existingAccount = await this.prisma.financialAccount.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });

      if (!existingAccount) {
        if (accountId === undefined || vendorHandle === undefined) {
          throw new BadRequestException("Both accountId and vendorHandle are required to create account details");
        }
        await this.prisma.financialAccount.create({
          data: {
            userId,
            encryptedAccountId: this.encryption.encrypt(accountId),
            encryptedVendorHandle: this.encryption.encrypt(vendorHandle)
          }
        });
      } else {
        const data: { encryptedAccountId?: string; encryptedVendorHandle?: string } = {};
        if (accountId !== undefined) {
          data.encryptedAccountId = this.encryption.encrypt(accountId);
        }
        if (vendorHandle !== undefined) {
          data.encryptedVendorHandle = this.encryption.encrypt(vendorHandle);
        }
        if (Object.keys(data).length > 0) {
          await this.prisma.financialAccount.update({ where: { id: existingAccount.id }, data });
        }
      }
    }

    return this.readForUser(userId);
  }

  private normalizeOptional(field: string, value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${field} cannot be empty`);
    }
    return trimmed;
  }
}
