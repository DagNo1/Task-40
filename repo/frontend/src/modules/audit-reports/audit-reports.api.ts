import { apiRequest, apiVersion } from "../../services/api/client";

export interface AuditLogItem {
  id: string;
  createdAt: string;
  userId?: string | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  notes: string;
}

function toParams(filters: { from?: string; to?: string; userId?: string; actionType?: string }): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.actionType) params.set("actionType", filters.actionType);
  return params.toString();
}

export async function searchAuditLogs(
  filters: { from?: string; to?: string; userId?: string; actionType?: string },
  csrfToken?: string | null
): Promise<AuditLogItem[]> {
  const query = toParams(filters);
  const response = await apiRequest<{ items: AuditLogItem[] }>(apiVersion, `/reports/audit?${query}`, {}, csrfToken);
  return response.items;
}

export async function exportAuditCsv(
  filters: { from?: string; to?: string; userId?: string; actionType?: string },
  csrfToken?: string | null
) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
  const query = toParams(filters);
  const headers = new Headers();
  if (csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(`${base}/${apiVersion}/reports/audit/export.csv?${query}`, {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!response.ok) {
    throw new Error("CSV export failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "audit-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
