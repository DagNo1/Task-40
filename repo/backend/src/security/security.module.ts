import { Global, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { AuthService } from "./auth/auth.service";
import { SessionService } from "./auth/session.service";
import { CsrfGuard } from "./csrf/csrf.guard";
import { CsrfService } from "./csrf/csrf.service";
import { FieldEncryptionService } from "./crypto/field-encryption.service";
import { MfaService } from "./mfa/mfa.service";
import { SignatureVerifierService } from "./signatures/signature-verifier.service";

@Injectable()
class SeedRunner implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    private readonly signatures: SignatureVerifierService
  ) {}

  async onModuleInit(): Promise<void> {
    this.signatures.assertConfigured();
    await this.authService.registerSeedUser();
  }
}

@Global()
@Module({
  providers: [
    AuthService,
    SessionService,
    MfaService,
    FieldEncryptionService,
    SignatureVerifierService,
    CsrfService,
    CsrfGuard,
    SeedRunner
  ],
  exports: [
    AuthService,
    SessionService,
    MfaService,
    FieldEncryptionService,
    SignatureVerifierService,
    CsrfService,
    CsrfGuard
  ]
})
export class SecurityModule {}
