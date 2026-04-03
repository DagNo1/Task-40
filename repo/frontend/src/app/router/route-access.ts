export type ProtectedRouteRule = {
  path: string;
  permission?: string;
};

export const protectedRouteRules: ProtectedRouteRule[] = [
  { path: "/editor-queue", permission: "stories.review" },
  { path: "/ingestion", permission: "stories.review" },
  { path: "/stories", permission: "stories.review" },
  { path: "/transactions", permission: "transactions.read" },
  { path: "/admin", permission: "admin.manage" },
  { path: "/audit-reports", permission: "audit.read" },
  { path: "/alerts", permission: "alerts.read" },
  { path: "/security" }
];

export function hasPermission(requiredPermission: string | undefined, permissions: string[]): boolean {
  if (!requiredPermission) {
    return true;
  }
  return permissions.includes(requiredPermission) || permissions.includes("admin.manage");
}

export function hasRoutePermission(path: string, permissions: string[]): boolean {
  const rule = protectedRouteRules.find((item) => item.path === path);
  if (!rule) {
    return false;
  }
  return hasPermission(rule.permission, permissions);
}

export function resolveNearestAllowedPath(permissions: string[]): string {
  const allowed = protectedRouteRules.find((item) => hasPermission(item.permission, permissions));
  return allowed?.path ?? "/security";
}
