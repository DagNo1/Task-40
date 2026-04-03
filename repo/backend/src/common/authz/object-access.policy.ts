import { ForbiddenException } from "@nestjs/common";

export interface AuthActor {
  userId?: string;
  roles?: string[];
  permissions?: string[];
}

export function hasAdminOverride(actor: AuthActor | undefined): boolean {
  if (!actor) {
    return false;
  }
  return (actor.permissions ?? []).includes("admin.manage") || (actor.roles ?? []).includes("admin");
}

export function ensureActorObjectAccess(
  actor: AuthActor | undefined,
  options: {
    ownerIds: Array<string | null | undefined>;
    context: string;
    allowIfAnyPermission?: string[];
    allowIfAnyRole?: string[];
  }
): void {
  if (hasAdminOverride(actor)) {
    return;
  }

  const actorPermissions = actor?.permissions ?? [];
  const actorRoles = actor?.roles ?? [];
  if (options.allowIfAnyPermission?.some((permission) => actorPermissions.includes(permission))) {
    return;
  }
  if (options.allowIfAnyRole?.some((role) => actorRoles.includes(role))) {
    return;
  }

  const actorId = actor?.userId;
  const normalizedOwners = options.ownerIds.filter((value): value is string => Boolean(value));
  if (!actorId || normalizedOwners.length === 0 || !normalizedOwners.includes(actorId)) {
    throw new ForbiddenException(`Not authorized for ${options.context}`);
  }
}
