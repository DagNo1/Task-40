import { ReactNode, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layouts/app-shell";
import { useAuth } from "../providers/auth-provider";
import { hasPermission, resolveNearestAllowedPath } from "./route-access";
import { AdminPage } from "../../modules/admin/admin-page";
import { AlertsPage } from "../../modules/alerts-dashboard/alerts-page";
import { AuditReportsPage } from "../../modules/audit-reports/audit-reports-page";
import { EditorQueuePage } from "../../modules/editor-queue/editor-queue-page";
import { IngestionPage } from "../../modules/ingestion/ingestion-page";
import { LoginPage } from "../../modules/auth/login-page";
import { SecurityPage } from "../../modules/security/security-page";
import { StoriesPage } from "../../modules/stories/stories-page";
import { TransactionsPage } from "../../modules/transactions/transactions-page";

function buildSessionScope(session: { userId: string; permissions: string[]; roles: string[] }): string {
  return [
    session.userId,
    session.roles.slice().sort().join(","),
    session.permissions.slice().sort().join(",")
  ].join("|");
}

function ProtectedRoutes() {
  const { session, refreshSession } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (session) {
      setChecked(true);
      return;
    }

    let active = true;
    void refreshSession()
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshSession, session]);

  if (!checked && !session) {
    return <div className="content"><div className="loading-state">Restoring active session.</div></div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell key={buildSessionScope(session)} />;
}

function PermissionRoute({
  requiredPermission,
  children
}: {
  requiredPermission?: string;
  children: ReactNode;
}) {
  const { session } = useAuth();
  const permissions = session?.permissions ?? [];
  if (!hasPermission(requiredPermission, permissions)) {
    return <Navigate to={resolveNearestAllowedPath(permissions)} replace />;
  }
  return <>{children}</>;
}

function DefaultProtectedRedirect() {
  const { session } = useAuth();
  return <Navigate to={resolveNearestAllowedPath(session?.permissions ?? [])} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoutes />}>
        <Route
          path="editor-queue"
          element={
            <PermissionRoute requiredPermission="stories.review">
              <EditorQueuePage />
            </PermissionRoute>
          }
        />
        <Route
          path="ingestion"
          element={
            <PermissionRoute requiredPermission="stories.review">
              <IngestionPage />
            </PermissionRoute>
          }
        />
        <Route
          path="stories"
          element={
            <PermissionRoute requiredPermission="stories.review">
              <StoriesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="transactions"
          element={
            <PermissionRoute requiredPermission="transactions.read">
              <TransactionsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="admin"
          element={
            <PermissionRoute requiredPermission="admin.manage">
              <AdminPage />
            </PermissionRoute>
          }
        />
        <Route
          path="audit-reports"
          element={
            <PermissionRoute requiredPermission="audit.read">
              <AuditReportsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="alerts"
          element={
            <PermissionRoute requiredPermission="alerts.read">
              <AlertsPage />
            </PermissionRoute>
          }
        />
        <Route path="security" element={<SecurityPage />} />
        <Route path="*" element={<DefaultProtectedRedirect />} />
      </Route>
    </Routes>
  );
}
