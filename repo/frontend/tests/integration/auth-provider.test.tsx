// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../src/app/providers/auth-provider";

const apiRequestMock = vi.fn();

vi.mock("../../src/services/api/client", () => ({
  apiVersion: "v1",
  apiRequest: (...args: unknown[]) => apiRequestMock(...args)
}));

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="user">{auth.session?.userId ?? "none"}</div>
      <div data-testid="permissions">{(auth.session?.permissions ?? []).join(",")}</div>
      <div data-testid="csrf">{auth.csrfToken ?? "none"}</div>
      <button type="button" onClick={() => void auth.login("user", "password")}>login</button>
      <button type="button" onClick={() => void auth.refreshSession()}>refresh</button>
      <button type="button" onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("clears previous session state on role switch and does not retain stale user data", async () => {
    apiRequestMock
      .mockResolvedValueOnce({ status: "ok", csrfToken: "csrf-u1" })
      .mockResolvedValueOnce({ userId: "u1", roles: ["editor"], permissions: ["stories.review"] })
      .mockResolvedValueOnce({ status: "ok" })
      .mockResolvedValueOnce({ status: "ok", csrfToken: "csrf-u2" })
      .mockResolvedValueOnce({ userId: "u2", roles: ["auditor"], permissions: ["audit.read"] });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(screen.getByTestId("permissions").textContent).toBe("stories.review");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();

    await act(async () => {
      screen.getByText("logout").click();
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();

    await act(async () => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("user").textContent).toBe("u2");
    expect(screen.getByTestId("permissions").textContent).toBe("audit.read");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();
  });

  it("maintains CSRF token lifecycle across login refresh and logout", async () => {
    apiRequestMock
      .mockResolvedValueOnce({ status: "ok", csrfToken: "csrf-login" })
      .mockResolvedValueOnce({ userId: "u1", roles: ["editor"], permissions: ["stories.review"] })
      .mockResolvedValueOnce({ userId: "u1", roles: ["editor"], permissions: ["stories.review"] })
      .mockResolvedValueOnce({ csrfToken: "csrf-refresh" })
      .mockResolvedValueOnce({ status: "ok" });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("csrf").textContent).toBe("csrf-login");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();

    await act(async () => {
      screen.getByText("refresh").click();
    });
    expect(screen.getByTestId("csrf").textContent).toBe("csrf-refresh");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();

    await act(async () => {
      screen.getByText("logout").click();
    });
    expect(screen.getByTestId("csrf").textContent).toBe("none");
    expect(window.sessionStorage.getItem("sentineldesk.csrfToken")).toBeNull();
  });
});
