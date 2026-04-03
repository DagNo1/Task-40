import { apiRequest, apiVersion } from "../../services/api/client";

export interface TransactionItem {
  id: string;
  reference: string;
  channel: string;
  totalAmountCents: number;
  status: string;
  statusExplanation: string;
  storyVersionId?: string | null;
  refundedCents: number;
  createdAt: string;
}

export interface StoryVersionOption {
  versionId: string;
  storyId: string;
  versionNumber: number;
  title: string;
  canonicalUrl: string;
  source: string;
  publishedAt?: string | null;
  createdAt: string;
}

export async function fetchTransactions(csrfToken?: string | null): Promise<TransactionItem[]> {
  const data = await apiRequest<{ items: TransactionItem[] }>(apiVersion, "/transactions", {}, csrfToken);
  return data.items;
}

export async function fetchTransactionHistory(transactionId: string, csrfToken?: string | null) {
  return apiRequest<{
    transaction: TransactionItem;
    statusExplanation: string;
    ledgerEntries: Array<{ id: string; entryType: string; amountCents: number; netAmountCents: number; createdAt: string }>;
    refunds: Array<{ id: string; amountCents: number; type: string; reason: string; storyVersionId?: string | null; createdAt: string }>;
    freezes: Array<{ id: string; status: string; reason: string; releaseNote?: string | null; frozenAt: string; releasedAt?: string | null }>;
    storyVersions: StoryVersionOption[];
    audits: Array<{ id: string; actionType: string; notes: string; createdAt: string }>;
    lifecycleSummary: string;
  }>(apiVersion, `/transactions/${encodeURIComponent(transactionId)}/history`, {}, csrfToken);
}

export async function fetchStoryVersionOptions(csrfToken?: string | null): Promise<StoryVersionOption[]> {
  const data = await apiRequest<{ items: StoryVersionOption[] }>(apiVersion, "/transactions/story-versions", {}, csrfToken);
  return data.items;
}

export async function createCharge(
  payload: {
    storyVersionId: string;
    channel: "prepaid_balance" | "invoice_credit" | "purchase_order_settlement";
    bundleCount?: number;
  },
  csrfToken?: string | null
) {
  return apiRequest(apiVersion, "/transactions/charges", { method: "POST", body: JSON.stringify(payload) }, csrfToken);
}

export async function approveCharge(transactionId: string, note: string, csrfToken?: string | null) {
  return apiRequest(
    apiVersion,
    `/transactions/${encodeURIComponent(transactionId)}/approve`,
    { method: "POST", body: JSON.stringify({ note }) },
    csrfToken
  );
}

export async function refundTransaction(
  transactionId: string,
  payload: { type: "full" | "partial"; amountCents?: number; storyVersionId: string; note: string },
  csrfToken?: string | null
) {
  return apiRequest(
    apiVersion,
    `/transactions/${encodeURIComponent(transactionId)}/refunds`,
    { method: "POST", body: JSON.stringify(payload) },
    csrfToken
  );
}

export async function freezeTransaction(transactionId: string, note: string, csrfToken?: string | null) {
  return apiRequest(
    apiVersion,
    `/transactions/${encodeURIComponent(transactionId)}/freeze`,
    { method: "POST", body: JSON.stringify({ note }) },
    csrfToken
  );
}

export async function releaseTransaction(transactionId: string, note: string, csrfToken?: string | null) {
  return apiRequest(
    apiVersion,
    `/transactions/${encodeURIComponent(transactionId)}/release`,
    { method: "POST", body: JSON.stringify({ note }) },
    csrfToken
  );
}
