// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../src/app/router/app-router";

let authState: {
  session: { userId: string; permissions: string[]; roles: string[] } | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  csrfToken: string | null;
};

vi.mock("../../src/app/providers/auth-provider", () => ({
  useAuth: () => authState
}));

vi.mock("../../src/app/layouts/app-shell", () => ({
  AppShell: () => {
    const [seed] = useState(authState.session?.userId ?? "none");
    return (
      <div>
        <div data-testid="shell-seed">{seed}</div>
        <Outlet />
      </div>
    );
  }
}));

vi.mock("../../src/modules/auth/login-page", () => ({ LoginPage: () => <div>login page</div> }));
vi.mock("../../src/modules/editor-queue/editor-queue-page", () => ({ EditorQueuePage: () => <div>editor page</div> }));
vi.mock("../../src/modules/ingestion/ingestion-page", () => ({ IngestionPage: () => <div>ingestion page</div> }));
vi.mock("../../src/modules/stories/stories-page", () => ({ StoriesPage: () => <div>stories page</div> }));
vi.mock("../../src/modules/transactions/transactions-page", () => ({ TransactionsPage: () => <div>transactions page</div> }));
vi.mock("../../src/modules/admin/admin-page", () => ({ AdminPage: () => <div>admin page</div> }));
vi.mock("../../src/modules/audit-reports/audit-reports-page", () => ({ AuditReportsPage: () => <div>audit page</div> }));
vi.mock("../../src/modules/alerts-dashboard/alerts-page", () => ({ AlertsPage: () => <div>alerts page</div> }));
vi.mock("../../src/modules/security/security-page", () => ({ SecurityPage: () => <div>security page</div> }));

describe("AppRouter security behavior", () => {
  afterEach(() => {
    cleanup();
  });

  it("redirects unauthorized protected routes to nearest allowed route", async () => {
    authState = {
      session: { userId: "u-audit", permissions: ["audit.read"], roles: ["auditor"] },
      refreshSession: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      csrfToken: "csrf"
    };

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText("audit page")).toBeTruthy();
  });

  it("redirects multiple unauthorized deep-links to allowed destination", async () => {
    const blockedRoutes = ["/admin", "/transactions", "/alerts", "/editor-queue", "/ingestion", "/stories"];

    for (const route of blockedRoutes) {
      authState = {
        session: { userId: "u-audit", permissions: ["audit.read"], roles: ["auditor"] },
        refreshSession: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        csrfToken: "csrf"
      };

      render(
        <MemoryRouter initialEntries={[route]}>
          <AppRouter />
        </MemoryRouter>
      );

      expect(await screen.findByText("audit page")).toBeTruthy();
      cleanup();
    }
  });

  it("remounts protected shell for user switch to prevent stale session view", async () => {
    authState = {
      session: { userId: "u1", permissions: ["stories.review"], roles: ["editor"] },
      refreshSession: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      csrfToken: "csrf-1"
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/editor-queue"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect((await screen.findByTestId("shell-seed")).textContent).toBe("u1");

    authState = {
      ...authState,
      session: { userId: "u2", permissions: ["stories.review"], roles: ["editor"] },
      csrfToken: "csrf-2"
    };

    rerender(
      <MemoryRouter initialEntries={["/editor-queue"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect((await screen.findByTestId("shell-seed")).textContent).toBe("u2");
  });
});
