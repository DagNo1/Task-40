import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import {
  approveCharge,
  createCharge,
  fetchStoryVersionOptions,
  fetchTransactionHistory,
  fetchTransactions,
  freezeTransaction,
  refundTransaction,
  releaseTransaction,
  StoryVersionOption,
  TransactionItem
} from "./transactions.api";

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatVersionLabel(version: StoryVersionOption): string {
  return `${version.title} (v${version.versionNumber}) - ${version.source}`;
}

type RefundVersionCandidate = {
  value: string;
  label: string;
};

export function TransactionsPage() {
  const { csrfToken, session } = useAuth();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [chargeChannel, setChargeChannel] = useState<"prepaid_balance" | "invoice_credit" | "purchase_order_settlement">("prepaid_balance");
  const [bundleCount, setBundleCount] = useState("1");
  const [chargeStoryVersionId, setChargeStoryVersionId] = useState("");
  const [refundStoryVersionId, setRefundStoryVersionId] = useState("");
  const [storyVersionOptions, setStoryVersionOptions] = useState<StoryVersionOption[]>([]);
  const [loading, setLoading] = useState(true);

  const permissions = new Set(session?.permissions ?? []);
  const canApprove = permissions.has("finance.review");
  const canRefund = permissions.has("finance.refund");
  const canFreeze = permissions.has("finance.freeze");
  const canRelease = permissions.has("auditor.release_freeze");

  useEffect(() => {
    void refresh();
    void loadStoryVersionOptions();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setHistory(null);
      return;
    }
    void loadHistory(selectedId);
  }, [selectedId]);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await fetchTransactions(csrfToken);
      setTransactions(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(transactionId: string) {
    try {
      const data = await fetchTransactionHistory(transactionId, csrfToken);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    }
  }

  async function loadStoryVersionOptions() {
    try {
      const rows = await fetchStoryVersionOptions(csrfToken);
      setStoryVersionOptions(rows);
      if (!chargeStoryVersionId && rows.length > 0) {
        setChargeStoryVersionId(rows[0].versionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load story version options");
    }
  }

  const selected = useMemo(
    () => transactions.find((item) => item.id === selectedId) ?? null,
    [transactions, selectedId]
  );

  const refundVersionCandidates = useMemo<RefundVersionCandidate[]>(() => {
    const fromHistory = (history?.storyVersions ?? []).map((version: StoryVersionOption) => ({
      value: version.versionId,
      label: formatVersionLabel(version)
    }));
    if (fromHistory.length > 0) {
      return fromHistory;
    }

    const fallbackIds = Array.from(
      new Set(
        [
          selected?.storyVersionId,
          history?.transaction?.storyVersionId,
          ...(history?.refunds ?? []).map((refund: { storyVersionId?: string | null }) => refund.storyVersionId)
        ].filter((value): value is string => Boolean(value))
      )
    );

    return fallbackIds.map((id) => ({ value: id, label: `Linked version ${id.slice(0, 8)}...` }));
  }, [selected, history]);

  useEffect(() => {
    const seeded = selected?.storyVersionId ?? history?.transaction?.storyVersionId ?? "";
    setRefundStoryVersionId((current) => (current ? current : seeded));
  }, [selected?.storyVersionId, history?.transaction?.storyVersionId]);

  async function runAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setNote("");
      setPartialAmount("");
      await refresh();
      if (selectedId) {
        await loadHistory(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction action failed");
    }
  }

  async function onCreateCharge(event: FormEvent) {
    event.preventDefault();
    if (!chargeStoryVersionId.trim()) {
      setError("Please select a story version for this charge.");
      return;
    }
    await runAction(() =>
      createCharge(
        {
          channel: chargeChannel,
          bundleCount: Number.parseInt(bundleCount, 10) || 1,
          storyVersionId: chargeStoryVersionId.trim()
        },
        csrfToken
      )
    );
  }

  return (
    <section className="panel transactions-layout">
      <div className="topbar">
        <div>
          <h1>Transactions Workspace</h1>
          <p className="page-intro">Review internal licensing charges, attach story context, and process approvals, refunds, freezes, and releases.</p>
        </div>
      </div>

      <ApiErrorBanner error={error} />

      <div className="transactions-grid">
        <aside className="transactions-list">
          {canApprove ? (
            <form className="charge-form action-panel" onSubmit={onCreateCharge}>
              <h3>New Charge</h3>
              <p className="field-hint">Every licensed bundle charge must remain tied to a story version.</p>
              <label>Channel</label>
              <select value={chargeChannel} onChange={(event) => setChargeChannel(event.target.value as any)}>
                <option value="prepaid_balance">Prepaid Balance</option>
                <option value="invoice_credit">Invoice Credit</option>
                <option value="purchase_order_settlement">PO Settlement</option>
              </select>
              <label>Bundle Count</label>
              <input value={bundleCount} onChange={(event) => setBundleCount(event.target.value)} />
              <label>Story Version (required)</label>
              <select value={chargeStoryVersionId} onChange={(event) => setChargeStoryVersionId(event.target.value)}>
                <option value="">Select story version</option>
                {storyVersionOptions.map((option) => (
                  <option key={option.versionId} value={option.versionId}>
                    {formatVersionLabel(option)}
                  </option>
                ))}
              </select>
              {storyVersionOptions.length === 0 ? (
                <p className="field-hint">No story versions available yet. Ingest stories first, then retry charge creation.</p>
              ) : null}
              <button type="submit">Create Charge</button>
            </form>
          ) : null}

          {loading ? <div className="loading-state">Loading transaction ledger and lifecycle status.</div> : null}
          {!loading && transactions.length === 0 ? (
            <div className="empty-state">No transactions found. Create a charge to start a story-linked finance record.</div>
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                className={`transaction-item ${tx.id === selectedId ? "selected" : ""}`}
                onClick={() => setSelectedId(tx.id)}
              >
                <strong>{tx.reference}</strong>
                <small>{centsToDollars(tx.totalAmountCents)}</small>
                <p>{tx.status}</p>
                <p>{tx.statusExplanation}</p>
              </button>
            ))
          )}
        </aside>

        <div className="transactions-main">
          {selected ? (
            <>
              <div className="detail-panel">
                <div className="detail-panel-header">
                  <div>
                    <h2>{selected.reference}</h2>
                    <p className="page-intro">{selected.statusExplanation}</p>
                  </div>
                  <div className="mono-text">{selected.storyVersionId ?? "No linked version"}</div>
                </div>
              </div>

              <div className="actions-row">
                <div className="required-block">
                  <label>Mandatory Action Note</label>
                  <p className="field-hint">Minimum 8 characters. Record approval, refund, freeze, or release justification.</p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Explain approval/refund/freeze/release decision"
                  />
                </div>
                <div className="actions-buttons">
                  {canApprove ? (
                    <button
                      onClick={() => runAction(() => approveCharge(selected.id, note, csrfToken))}
                      disabled={note.trim().length < 8}
                    >
                      Approve Charge
                    </button>
                  ) : null}
                  {canRefund ? (
                    <>
                      <div className="actions-group-title">Refund controls</div>
                      {refundVersionCandidates.length > 0 ? (
                        <>
                          <label>Refund Story Version</label>
                          <select
                            value={refundStoryVersionId}
                            onChange={(event) => setRefundStoryVersionId(event.target.value)}
                          >
                            <option value="">Select story version</option>
                            {refundVersionCandidates.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                      {refundVersionCandidates.length === 0 ? (
                        <p className="field-hint">No linked story versions available for this transaction yet.</p>
                      ) : null}
                      <button
                        className="danger-action"
                        onClick={() => {
                          if (!refundStoryVersionId.trim()) {
                            setError("Please select a story version for the refund.");
                            return;
                          }
                          void runAction(() =>
                            refundTransaction(
                              selected.id,
                              { type: "full", note, storyVersionId: refundStoryVersionId.trim() },
                              csrfToken
                            )
                          );
                        }}
                        disabled={note.trim().length < 8 || !refundStoryVersionId}
                      >
                        Full Refund
                      </button>
                      <input
                        placeholder="Partial cents"
                        value={partialAmount}
                        onChange={(event) => setPartialAmount(event.target.value)}
                      />
                      <button
                        className="danger-action"
                        onClick={() => {
                          if (!refundStoryVersionId.trim()) {
                            setError("Please select a story version for the refund.");
                            return;
                          }
                          void runAction(() =>
                            refundTransaction(
                              selected.id,
                              {
                                type: "partial",
                                amountCents: Number.parseInt(partialAmount, 10),
                                note,
                                storyVersionId: refundStoryVersionId.trim()
                              },
                              csrfToken
                            )
                          );
                        }}
                        disabled={note.trim().length < 8 || !refundStoryVersionId}
                      >
                        Partial Refund
                      </button>
                    </>
                  ) : null}
                  {canFreeze ? (
                    <button
                      className="danger-action"
                      onClick={() => runAction(() => freezeTransaction(selected.id, note, csrfToken))}
                      disabled={note.trim().length < 8}
                    >
                      Freeze
                    </button>
                  ) : null}
                  {canRelease ? (
                    <button
                      onClick={() => runAction(() => releaseTransaction(selected.id, note, csrfToken))}
                      disabled={note.trim().length < 8}
                    >
                      Auditor Release
                    </button>
                  ) : null}
                </div>
              </div>

              {history ? (
                <div className="history-block">
                  <h3>Lifecycle Explanation</h3>
                  <p>{history.lifecycleSummary}</p>

                  <h3>Ledger Entries</h3>
                  <div className="history-table">
                    {history.ledgerEntries.map((entry: any) => (
                      <div className="history-row" key={entry.id}>
                        <span>{entry.entryType}</span>
                        <span>{centsToDollars(entry.amountCents)}</span>
                        <span>Net {centsToDollars(entry.netAmountCents)}</span>
                      </div>
                    ))}
                  </div>

                  <h3>Refund Cases</h3>
                  <div className="history-table">
                    {history.refunds.map((refund: any) => (
                      <div className="history-row" key={refund.id}>
                        <span>{refund.type}</span>
                        <span>{centsToDollars(refund.amountCents)}</span>
                        <span>{refund.reason}</span>
                      </div>
                    ))}
                  </div>

                  <h3>Freeze Cases</h3>
                  <div className="history-table">
                    {history.freezes.map((freeze: any) => (
                      <div className="history-row" key={freeze.id}>
                        <span>{freeze.status}</span>
                        <span>{freeze.reason}</span>
                        <span>{freeze.releaseNote ?? "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p>No transactions found.</p>
          )}
        </div>
      </div>
    </section>
  );
}
