import { apiRequest, apiVersion } from "../../services/api/client";

export interface AdminOverview {
  roles: Array<{ id: string; name: string; description?: string | null; permissionKeys: string[] }>;
  permissions: Array<{ id: string; key: string; description?: string | null }>;
  users: Array<{ id: string; username: string; roleIds: string[]; roleNames: string[]; requestsPerMinute: number }>;
  thresholds: Array<{ key: string; value: string; description?: string | null }>;
}

export async function fetchAdminOverview(csrfToken?: string | null): Promise<AdminOverview> {
  return apiRequest<AdminOverview>(apiVersion, "/admin/overview", {}, csrfToken);
}

export async function upsertRole(
  payload: { roleId?: string; name: string; description?: string; permissionKeys: string[]; changeNote: string },
  csrfToken?: string | null
) {
  return apiRequest(apiVersion, "/admin/roles", { method: "PUT", body: JSON.stringify(payload) }, csrfToken);
}

export async function setUserRoles(
  userId: string,
  payload: { roleIds: string[]; changeNote: string },
  csrfToken?: string | null
) {
  return apiRequest(
    apiVersion,
    `/admin/users/${encodeURIComponent(userId)}/roles`,
    { method: "PUT", body: JSON.stringify(payload) },
    csrfToken
  );
}

export async function setUserRateLimit(
  userId: string,
  payload: { requestsPerMinute: number; changeNote: string },
  csrfToken?: string | null
) {
  return apiRequest(
    apiVersion,
    `/admin/users/${encodeURIComponent(userId)}/rate-limit`,
    { method: "PUT", body: JSON.stringify(payload) },
    csrfToken
  );
}

export async function setThreshold(
  key: string,
  payload: { value: string; changeNote: string },
  csrfToken?: string | null
) {
  return apiRequest(
    apiVersion,
    `/admin/thresholds/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify(payload) },
    csrfToken
  );
}

export async function fetchPermissionSensitiveOperations(
  filters: { from?: string; to?: string; userId?: string; actionType?: string },
  csrfToken?: string | null
) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.actionType) params.set("actionType", filters.actionType);
  return apiRequest<Array<{ id: string; createdAt: string; userId?: string | null; actionType: string; notes: string }>>(
    apiVersion,
    `/admin/operations/permission-sensitive?${params.toString()}`,
    {},
    csrfToken
  );
}
