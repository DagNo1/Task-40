// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditReportsPage } from "../../src/modules/audit-reports/audit-reports-page";

const mocks = vi.hoisted(() => ({
  auth: {
    csrfToken: "csrf-token"
  },
  api: {
    searchAuditLogs: vi.fn(),
    exportAuditCsv: vi.fn()
  }
}));

vi.mock("../../src/app/providers/auth-provider", () => ({
  useAuth: () => mocks.auth
}));

vi.mock("../../src/modules/audit-reports/audit-reports.api", () => mocks.api);

describe("AuditReports date validation", () => {
  beforeEach(() => {
    mocks.api.searchAuditLogs.mockReset();
    mocks.api.exportAuditCsv.mockReset();
    mocks.api.searchAuditLogs.mockResolvedValue([]);
    mocks.api.exportAuditCsv.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("blocks invalid MM/DD/YYYY before search request", async () => {
    render(<AuditReportsPage />);

    fireEvent.change(screen.getByPlaceholderText("03/28/2026"), { target: { value: "2026-03-28" } });
    fireEvent.click(screen.getByText("Search"));

    expect(await screen.findByText("Use MM/DD/YYYY (example: 03/30/2026)."));
    expect(mocks.api.searchAuditLogs).not.toHaveBeenCalled();
  });

  it("blocks from/to range inversion before search", async () => {
    render(<AuditReportsPage />);

    fireEvent.change(screen.getByPlaceholderText("03/28/2026"), { target: { value: "03/30/2026" } });
    fireEvent.change(screen.getByPlaceholderText("03/29/2026"), { target: { value: "03/29/2026" } });
    fireEvent.click(screen.getByText("Search"));

    expect(await screen.findByText("From date must be earlier than or equal to To date."));
    expect(mocks.api.searchAuditLogs).not.toHaveBeenCalled();
  });

  it("allows valid dates and sends request", async () => {
    render(<AuditReportsPage />);

    fireEvent.change(screen.getByPlaceholderText("03/28/2026"), { target: { value: "03/28/2026" } });
    fireEvent.change(screen.getByPlaceholderText("03/29/2026"), { target: { value: "03/30/2026" } });
    fireEvent.click(screen.getByText("Search"));

    expect(mocks.api.searchAuditLogs).toHaveBeenCalledWith(
      {
        from: "03/28/2026",
        to: "03/30/2026",
        userId: undefined,
        actionType: undefined
      },
      "csrf-token"
    );
  });

  it("blocks invalid dates for CSV export", async () => {
    render(<AuditReportsPage />);

    fireEvent.change(screen.getByPlaceholderText("03/29/2026"), { target: { value: "13/01/2026" } });
    fireEvent.click(screen.getByText("Export CSV"));

    expect(await screen.findByText("Use MM/DD/YYYY (example: 03/30/2026)."));
    expect(mocks.api.exportAuditCsv).not.toHaveBeenCalled();
  });
});
