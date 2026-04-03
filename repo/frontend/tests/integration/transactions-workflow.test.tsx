// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionsPage } from "../../src/modules/transactions/transactions-page";

const mocks = vi.hoisted(() => ({
  authState: {
    csrfToken: "csrf-token" as string | null,
    session: null as { userId: string; permissions: string[]; roles: string[] } | null
  },
  transactionsApi: {
    approveCharge: vi.fn(),
    createCharge: vi.fn(),
    fetchStoryVersionOptions: vi.fn(),
    fetchTransactionHistory: vi.fn(),
    fetchTransactions: vi.fn(),
    freezeTransaction: vi.fn(),
    refundTransaction: vi.fn(),
    releaseTransaction: vi.fn()
  }
}));

vi.mock("../../src/app/providers/auth-provider", () => ({
  useAuth: () => mocks.authState
}));

vi.mock("../../src/modules/transactions/transactions.api", () => mocks.transactionsApi);

const baseTransaction = {
  id: "tx-1",
  reference: "TX-1",
  channel: "prepaid_balance",
  totalAmountCents: 2500,
  status: "PENDING",
  statusExplanation: "Pending approval",
  refundedCents: 0,
  createdAt: "2026-03-30T00:00:00.000Z"
};

describe("Transactions workflow integration", () => {
  beforeEach(() => {
    Object.values(mocks.transactionsApi).forEach((mock) => mock.mockReset());
    mocks.transactionsApi.fetchStoryVersionOptions.mockResolvedValue([]);
    mocks.transactionsApi.fetchTransactionHistory.mockResolvedValue({
      transaction: { ...baseTransaction, storyVersionId: null },
      statusExplanation: "Pending approval",
      ledgerEntries: [],
      refunds: [],
      freezes: [],
      storyVersions: [],
      audits: [],
      lifecycleSummary: "summary"
    });
    mocks.transactionsApi.fetchTransactions.mockResolvedValue([{ ...baseTransaction, storyVersionId: null }]);
  });

  afterEach(() => {
    cleanup();
  });

  it("enforces role-based action visibility and note requirement for approvals", async () => {
    mocks.authState = {
      csrfToken: "csrf-token",
      session: { userId: "finance-1", permissions: ["finance.review", "transactions.read"], roles: ["finance"] }
    };

    render(<TransactionsPage />);

    expect((await screen.findAllByText("TX-1")).length).toBeGreaterThan(0);
    expect(screen.getByText("Approve Charge")).toBeTruthy();
    expect(screen.queryByText("Full Refund")).toBeNull();
    expect(screen.queryByText("Freeze")).toBeNull();
    expect(screen.queryByText("Auditor Release")).toBeNull();

    const approveButton = screen.getByText("Approve Charge") as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Explain approval/refund/freeze/release decision"), {
      target: { value: "approved note" }
    });
    expect((screen.getByText("Approve Charge") as HTMLButtonElement).disabled).toBe(false);
  });

  it("enforces refund story-version constraint for refund-capable roles", async () => {
    mocks.authState = {
      csrfToken: "csrf-token",
      session: { userId: "finance-2", permissions: ["finance.refund", "transactions.read"], roles: ["finance"] }
    };

    render(<TransactionsPage />);

    expect((await screen.findAllByText("TX-1")).length).toBeGreaterThan(0);
    expect(screen.getByText("Full Refund")).toBeTruthy();
    expect(screen.getByText("No linked story versions available for this transaction yet.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Explain approval/refund/freeze/release decision"), {
      target: { value: "refund note" }
    });

    expect((screen.getByText("Full Refund") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Partial Refund") as HTMLButtonElement).disabled).toBe(true);
  });
});
