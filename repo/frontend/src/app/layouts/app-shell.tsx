import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { fetchActiveBanners } from "../../modules/alerts-dashboard/alerts.api";
import { useAuth } from "../providers/auth-provider";

type NavLinkItem = {
  to: string;
  label: string;
  permission?: string;
};

const links: NavLinkItem[] = [
  { to: "/ingestion", label: "Ingestion", permission: "stories.review" },
  { to: "/stories", label: "Stories", permission: "stories.review" },
  { to: "/editor-queue", label: "Editor Queue", permission: "stories.review" },
  { to: "/transactions", label: "Transactions", permission: "transactions.read" },
  { to: "/admin", label: "Admin", permission: "admin.manage" },
  { to: "/audit-reports", label: "Audit Reports", permission: "audit.read" },
  { to: "/alerts", label: "Alerts", permission: "alerts.read" },
  { to: "/security", label: "Security" }
];

export function AppShell() {
  const { session, logout, csrfToken } = useAuth();
  const permissions = new Set(session?.permissions ?? []);
  const [banners, setBanners] = useState<Array<{ id: string; level: string; message: string }>>([]);
  const [shellError, setShellError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissions.has("alerts.read") && !permissions.has("admin.manage")) {
      return;
    }
    void fetchActiveBanners(csrfToken)
      .then((rows) => {
        setBanners(rows);
        setShellError(null);
      })
      .catch((err) => {
        setBanners([]);
        setShellError(err instanceof Error ? err.message : "Failed to load active banners");
      });
  }, [csrfToken, session?.userId]);

  async function onSignOut() {
    setShellError(null);
    try {
      await logout();
    } catch (err) {
      setShellError(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-kicker">On-Prem Local</span>
          <h2>SentinelDesk</h2>
          <p>Newsroom control console</p>
        </div>
        <nav>
          {links
            .filter(
              (link) =>
                !link.permission || permissions.has(link.permission) || permissions.has("admin.manage")
            )
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {link.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <button className="button-ghost" onClick={() => void onSignOut()}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="content">
        <ApiErrorBanner error={shellError} />
        {banners.length > 0 ? (
          <div className="banner-strip">
            {banners.map((banner) => (
              <div key={banner.id} className={`banner-item ${banner.level.toLowerCase()}`}>
                <strong>{banner.level}</strong>: {banner.message}
              </div>
            ))}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
