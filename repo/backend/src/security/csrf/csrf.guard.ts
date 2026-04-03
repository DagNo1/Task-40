import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { createHash } from "crypto";
import { Request } from "express";
import { PrismaService } from "../../modules/prisma/prisma.service";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!STATE_CHANGING.has(request.method.toUpperCase())) {
      return true;
    }

    const sessionId = request.cookies?.sid as string | undefined;
    if (!sessionId) {
      throw new ForbiddenException("Missing session for CSRF validation");
    }

    const token = request.headers["x-csrf-token"] as string | undefined;
    if (!token) {
      throw new ForbiddenException("Missing CSRF token");
    }

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new ForbiddenException("Missing session for CSRF validation");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (session.csrfTokenHash !== tokenHash) {
      throw new ForbiddenException("Invalid CSRF token");
    }

    return true;
  }
}
