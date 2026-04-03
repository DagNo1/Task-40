import { useEffect, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { fetchAlertsDashboard, resolveAlert } from "./alerts.api";

export function AlertsPage() {
  const { csrfToken } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const payload = await fetchAlertsDashboard(csrfToken);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  async function onResolve(alertId: string) {
    setError(null);
    try {
      await resolveAlert(alertId, csrfToken);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve alert");
    }
  }

  return (
    <section className="panel alerts-layout">
      <div className="topbar">
        <div>
          <h1>Alerts Dashboard</h1>
          <p className="page-intro">Review local operations status, active banners, and unresolved alerts from scheduled jobs.</p>
        </div>
      </div>
      <ApiErrorBanner error={error} />
      {loading ? <div className="loading-state">Loading alerts dashboard.</div> : null}

      <div className="summary-grid">
        <div className="summary-card">
          <h3>Queue Depth</h3>
          <div className="metric-value">{data?.status?.queueDepth ?? 0}</div>
        </div>
        <div className="summary-card">
          <h3>Open Alerts</h3>
          <div className="metric-value">{data?.status?.alertsOpen ?? 0}</div>
        </div>
        <div className="summary-card">
          <h3>Active Banners</h3>
          <div className="metric-value">{data?.status?.activeBanners ?? 0}</div>
        </div>
        <div className="summary-card">
          <h3>Backup Window</h3>
          <div className="metric-value">{data?.status?.backupPolicy?.nightlyRunAt ?? "02:00"}</div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Active Banners</h3>
        <div className="history-table">
          {(data?.banners ?? []).length === 0 && !loading ? (
            <div className="empty-state">No active operator banners. Scheduled notifications will appear here.</div>
          ) : (
            (data?.banners ?? []).map((banner: any) => (
              <div className="history-row" key={banner.id}>
                <span>{banner.level}</span>
                <span>{new Date(banner.createdAt).toLocaleString()}</span>
                <span>{banner.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-card">
        <h3>Open Alerts</h3>
        <div className="history-table">
          {(data?.alerts ?? []).length === 0 && !loading ? (
            <div className="empty-state">No open alerts. Local operations are currently quiet.</div>
          ) : (
            (data?.alerts ?? []).map((alert: any) => (
              <div className="history-row" key={alert.id}>
                <span>{alert.category}</span>
                <span>{new Date(alert.createdAt).toLocaleString()}</span>
                <span>
                  {alert.title}: {alert.message}
                  <button className="button-secondary" onClick={() => void onResolve(alert.id)} style={{ marginLeft: "0.5rem" }}>
                    Resolve
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
