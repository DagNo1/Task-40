import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { map, Observable } from "rxjs";

const REDACT_KEYS = [
  "passwordHash",
  "mfaSecretCipher",
  "encryptedAccountId",
  "encryptedVendorHandle",
  "encryptedEmail",
  "encryptedPhone"
];

const ROLE_MASK_KEYS = ["sourceExternalId", "beforeRef", "afterRef", "actor", "userId"];

function redact(value: unknown, canViewSensitive: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, canViewSensitive));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.keys(record).forEach((key) => {
      if (REDACT_KEYS.includes(key)) {
        next[key] = "[REDACTED]";
      } else if (!canViewSensitive && ROLE_MASK_KEYS.includes(key)) {
        next[key] = "[MASKED_BY_ROLE]";
      } else {
        next[key] = redact(record[key], canViewSensitive);
      }
    });
    return next;
  }
  return value;
}

@Injectable()
export class RedactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ auth?: { permissions?: string[] } }>();
    const permissions = request?.auth?.permissions ?? [];
    const canViewSensitive = permissions.includes("admin.manage") || permissions.includes("stories.unmasked");

    return next.handle().pipe(map((data) => redact(data, canViewSensitive)));
  }
}
