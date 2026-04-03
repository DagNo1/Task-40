import { apiRequest, apiVersion } from "../../services/api/client";

export async function fetchAlertsDashboard(csrfToken?: string | null) {
  return apiRequest<any>(apiVersion, "/alerts/dashboard", {}, csrfToken);
}

export async function resolveAlert(alertId: string, csrfToken?: string | null) {
  return apiRequest<any>(apiVersion, `/alerts/${encodeURIComponent(alertId)}/resolve`, { method: "PATCH" }, csrfToken);
}

export interface ActiveBanner {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

export async function fetchActiveBanners(csrfToken?: string | null): Promise<ActiveBanner[]> {
  const payload = await fetchAlertsDashboard(csrfToken);
  return payload.banners ?? [];
}
