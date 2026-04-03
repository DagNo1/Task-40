import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../modules/prisma/prisma.service";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export interface SessionContext {
  id: string;
  userId: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, csrfTokenHash: string): Promise<{ id: string; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const absoluteExpireAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);
    const session = await this.prisma.session.create({
      data: {
        userId,
        csrfTokenHash,
        expiresAt,
        absoluteExpireAt
      }
    });

    return { id: session.id, expiresAt };
  }

  async validateAndRefresh(sessionId: string): Promise<SessionContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePerms: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!session || session.revokedAt) {
      return null;
    }

    const now = new Date();
    if (session.expiresAt < now || session.absoluteExpireAt < now) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    const refreshed = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: now, expiresAt: refreshed }
    });

    const roles = session.user.userRoles.map(
      (r: { role: { name: string } }) => r.role.name
    );
    const permissions = session.user.userRoles.flatMap(
      (r: { role: { rolePerms: { permission: { key: string } }[] } }) =>
        r.role.rolePerms.map((rp: { permission: { key: string } }) => rp.permission.key)
    );

    return {
      id: session.id,
      userId: session.userId,
      roles,
      permissions
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
  }

  async rotateCsrfTokenHash(sessionId: string, csrfTokenHash: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { csrfTokenHash }
    });
  }
}
