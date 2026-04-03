import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Request } from "express";
import { SessionService } from "../../security/auth/session.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.sid as string | undefined;

    if (!sessionId) {
      throw new UnauthorizedException("Missing session cookie");
    }

    const session = await this.sessionService.validateAndRefresh(sessionId);
    if (!session) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    (request as Request & { auth?: unknown }).auth = {
      userId: session.userId,
      sessionId: session.id,
      roles: session.roles,
      permissions: session.permissions
    };

    return true;
  }
}
