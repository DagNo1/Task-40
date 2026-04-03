import { FormEvent, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { exportAuditCsv, searchAuditLogs } from "./audit-reports.api";

type AuditFilters = {
  from?: string;
  to?: string;
  userId?: string;
  actionType?: string;
};

type ValidationErrors = {
  from?: string;
  to?: string;
  range?: string;
};

function parseUsDate(value: string): Date | null {
  const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isExact =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isExact ? date : null;
}

function validateFilters(from: string, to: string): ValidationErrors {
  const errors: ValidationErrors = {};
  const fromValue = from.trim();
  const toValue = to.trim();

  const fromDate = fromValue ? parseUsDate(fromValue) : null;
  const toDate = toValue ? parseUsDate(toValue) : null;

  if (fromValue && !fromDate) {
    errors.from = "Use MM/DD/YYYY (example: 03/30/2026).";
  }
  if (toValue && !toDate) {
    errors.to = "Use MM/DD/YYYY (example: 03/30/2026).";
  }
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.range = "From date must be earlier than or equal to To date.";
  }

  return errors;
}

export function AuditReportsPage() {
  const { csrfToken } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");
  const [items, setItems] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationErrors>({});

  function buildFilters(): AuditFilters {
    return {
      from: from || undefined,
      to: to || undefined,
      userId: userId || undefined,
      actionType: actionType || undefined
    };
  }

  function runValidation(): boolean {
    const next = validateFilters(from, to);
    setValidation(next);
    return Object.keys(next).length === 0;
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!runValidation()) {
      return;
    }
    setLoading(true);
    try {
      const rows = await searchAuditLogs(buildFilters(), csrfToken);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit search failed");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    setError(null);
    if (!runValidation()) {
      return;
    }
    try {
      await exportAuditCsv(buildFilters(), csrfToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed");
    }
  }

  return (
    <section className="panel audit-layout">
      <div className="topbar">
        <div>
          <h1>Audit Reports</h1>
          <p className="page-intro">Search immutable audit activity by date, user, and action type, then export the working set.</p>
        </div>
      </div>

      <form className="audit-filters" onSubmit={onSearch}>
        <label>From (MM/DD/YYYY)</label>
        <input
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            if (validation.from || validation.range) {
              setValidation((current) => ({ ...current, from: undefined, range: undefined }));
            }
          }}
          aria-invalid={Boolean(validation.from || validation.range)}
          placeholder="03/28/2026"
        />
        {validation.from ? <p className="error-text" role="alert">{validation.from}</p> : null}
        <label>To (MM/DD/YYYY)</label>
        <input
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            if (validation.to || validation.range) {
              setValidation((current) => ({ ...current, to: undefined, range: undefined }));
            }
          }}
          aria-invalid={Boolean(validation.to || validation.range)}
          placeholder="03/29/2026"
        />
        {validation.to ? <p className="error-text" role="alert">{validation.to}</p> : null}
        {validation.range ? <p className="error-text" role="alert">{validation.range}</p> : null}
        <label>User ID</label>
        <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="optional" />
        <label>Action Type</label>
        <input
          value={actionType}
          onChange={(event) => setActionType(event.target.value)}
          placeholder="e.g. MERGE_APPLIED"
        />
        <div className="audit-actions">
          <button type="submit">Search</button>
          <button className="button-secondary" type="button" onClick={() => void onExport()}>
            Export CSV
          </button>
        </div>
      </form>

      <ApiErrorBanner error={error} />
      {loading ? <div className="loading-state">Searching audit records.</div> : null}

      <div className="history-table">
        {!loading && items.length === 0 ? (
          <div className="empty-state">No audit results yet. Apply a date range or search all recent activity.</div>
        ) : (
          items.map((item) => (
            <div className="history-row" key={item.id}>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <span>{item.actionType}</span>
              <span>{item.notes}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
