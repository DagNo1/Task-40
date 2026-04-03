import { Fragment } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import {
  DiffField,
  EditorQueueItem,
  fetchEditorQueue,
  fetchStoryDiff,
  submitRepair,
  submitMerge
} from "./editor-queue.api";

type MergeStrategy = "replace" | "append" | "keep_both";

const STRATEGY_GUIDE: Record<MergeStrategy, string> = {
  replace: "Use incoming as latest version on target story.",
  append: "Combine incoming content into target story.",
  keep_both: "Keep this as a separate story/version."
};

function FlagBadge({ label, tone }: { label: string; tone: "warn" | "danger" }) {
  return <span className={`flag-badge ${tone}`}>{label}</span>;
}

function DiffGrid({ fields }: { fields: DiffField[] }) {
  return (
    <div className="diff-grid">
      <div className="diff-header">Field</div>
      <div className="diff-header">Previous</div>
      <div className="diff-header">Incoming</div>
      {fields.map((field) => (
        <Fragment key={field.field}>
          <div className="diff-field">
            {field.field}
          </div>
          <div className={`diff-cell ${field.changed ? "changed" : ""}`}>
            {field.left || "-"}
          </div>
          <div className={`diff-cell ${field.changed ? "changed" : ""}`}>
            {field.right || "-"}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function EditorQueuePage() {
  const { csrfToken } = useAuth();
  const [queue, setQueue] = useState<EditorQueueItem[]>([]);
  const [selected, setSelected] = useState<EditorQueueItem | null>(null);
  const [diff, setDiff] = useState<DiffField[]>([]);
  const [strategy, setStrategy] = useState<MergeStrategy>("replace");
  const [mergeTargetStoryId, setMergeTargetStoryId] = useState("");
  const [note, setNote] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyRepair, setBusyRepair] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reloadQueue();
  }, []);

  async function reloadQueue() {
    setLoading(true);
    try {
      const items = await fetchEditorQueue(csrfToken);
      setQueue(items);
      if (items.length > 0) {
        setSelected((current) => current ?? items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadDiff() {
      if (!selected || !selected.previousVersionId) {
        setDiff([]);
        return;
      }
      try {
        const fields = await fetchStoryDiff(
          selected.storyId,
          selected.previousVersionId,
          selected.versionId,
          csrfToken
        );
        setDiff(fields);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load diff");
      }
    }

    void loadDiff();
  }, [selected, csrfToken]);

  useEffect(() => {
    setMergeTargetStoryId(selected?.suggestedTargetStoryId ?? "");
  }, [selected?.suggestedTargetStoryId, selected?.storyId]);

  const mergeTargetOptions = useMemo(() => {
    if (!selected) {
      return [] as Array<{ value: string; label: string }>;
    }

    if (selected.mergeTargets && selected.mergeTargets.length > 0) {
      return selected.mergeTargets.map((target) => ({
        value: target.storyId,
        label: `${target.title} - ${target.canonicalUrl}`
      }));
    }

    if (selected.suggestedTargetStoryId) {
      return [{ value: selected.suggestedTargetStoryId, label: "Suggested related story" }];
    }

    return [];
  }, [selected]);

  const selectedMergeTargetLabel = useMemo(() => {
    if (!mergeTargetStoryId) {
      return "";
    }
    return (
      mergeTargetOptions.find((option) => option.value === mergeTargetStoryId)?.label ??
      `Story ${mergeTargetStoryId}`
    );
  }, [mergeTargetOptions, mergeTargetStoryId]);

  const reviewReasons = useMemo(() => {
    if (!selected) {
      return [] as string[];
    }

    const reasons: string[] = [];
    if (selected.nearDuplicate) {
      reasons.push(
        selected.duplicateExplanation ||
          "Near-duplicate match detected."
      );
    }
    if (selected.suspiciousAnomaly) {
      reasons.push(
        selected.anomalyExplanation ||
          "Suspicious anomaly detected."
      );
    }
    if (selected.previousVersionId) {
      reasons.push("Previous version exists for comparison.");
    }
    if ((selected.mergeTargets?.length ?? 0) > 0 || selected.suggestedTargetStoryId) {
      reasons.push("Target story candidate found.");
    }
    if (reasons.length === 0) {
      reasons.push("Queued for editorial review.");
    }
    return reasons;
  }, [selected]);

  useEffect(() => {
    if (!selected || mergeTargetOptions.length === 0) {
      return;
    }

    if (!mergeTargetStoryId || !mergeTargetOptions.some((option) => option.value === mergeTargetStoryId)) {
      setMergeTargetStoryId(mergeTargetOptions[0].value);
    }
  }, [mergeTargetOptions, mergeTargetStoryId, selected]);

  useEffect(() => {
    if (strategy !== "keep_both" && mergeTargetOptions.length === 0) {
      setStrategy("keep_both");
    }
  }, [mergeTargetOptions.length, strategy]);

  const requiresTargetStory = strategy !== "keep_both";
  const hasValidMergeTarget = !requiresTargetStory || mergeTargetStoryId.trim().length > 0;
  const canSubmit = useMemo(
    () => note.trim().length >= 8 && !!selected && !busy && hasValidMergeTarget,
    [note, selected, busy, hasValidMergeTarget]
  );
  const canRepair = useMemo(
    () => repairNote.trim().length >= 8 && !!selected?.versionId && !busyRepair,
    [repairNote, selected, busyRepair]
  );

  async function onSubmitMerge(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (strategy !== "keep_both" && !mergeTargetStoryId.trim()) {
        setError("No authorized target story is available for this item. Use Keep Both.");
        return;
      }

      await submitMerge(
        {
          incomingVersionId: selected.versionId,
          targetStoryId: strategy === "keep_both" ? undefined : mergeTargetStoryId.trim(),
          strategy,
          note: note.trim()
        },
        csrfToken
      );
      setNote("");
      await reloadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitRepair(event: FormEvent) {
    event.preventDefault();
    if (!selected?.versionId) {
      return;
    }
    setBusyRepair(true);
    setError(null);
    try {
      await submitRepair(selected.versionId, { note: repairNote.trim() }, csrfToken);
      setRepairNote("");
      await reloadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setBusyRepair(false);
    }
  }

  return (
    <section className="panel editor-queue-layout">
      <div className="topbar">
        <div>
          <h1>Editor Queue</h1>
          <p className="page-intro">Review flagged items and complete merge or repair decisions.</p>
        </div>
      </div>

      <ApiErrorBanner error={error} />

      <div className="queue-columns">
        <aside className="queue-list">
          {loading ? <div className="loading-state">Loading editor queue candidates.</div> : null}
          {!loading && queue.length === 0 ? (
            <div className="empty-state">No items in queue. Submit new ingestion to review incoming story versions.</div>
          ) : (
            queue.map((item) => (
              <button
                className={`queue-card ${selected?.queueId === item.queueId ? "selected" : ""}`}
                key={item.queueId}
                onClick={() => setSelected(item)}
              >
                <strong>{item.title}</strong>
                <small title={item.normalizedUrl}>{item.normalizedUrl}</small>
                <div className="queue-flags">
                  {item.nearDuplicate ? <FlagBadge label="Near Duplicate" tone="warn" /> : null}
                  {item.suspiciousAnomaly ? <FlagBadge label="Suspicious" tone="danger" /> : null}
                </div>
                {item.duplicateExplanation ? <p>{item.duplicateExplanation}</p> : null}
                {item.anomalyExplanation ? <p>{item.anomalyExplanation}</p> : null}
              </button>
            ))
          )}
        </aside>

        <div className="queue-main">
          {selected ? (
            <>
              <div className="detail-panel">
                <div className="detail-panel-header">
                  <div>
                    <h2>Selected Item</h2>
                    <p className="page-intro">{selected.title}</p>
                  </div>
                </div>

                <div className="review-summary-grid">
                  <div className="review-summary-card">
                    <h3>Why in Review</h3>
                    <ul>
                      {reviewReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="review-summary-card">
                    <h3>Next Step</h3>
                    <ol>
                      <li>Check diff.</li>
                      <li>Choose strategy.</li>
                      <li>Add note and submit.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="detail-panel">
                <div className="detail-panel-header"><h2>Diff</h2></div>
                {selected.previousVersionId ? (
                  <DiffGrid fields={diff} />
                ) : (
                  <div className="empty-state">No previous version available for side-by-side diff. You can still document and process the item.</div>
                )}
              </div>

              <div className="decision-stack">
                <form className="decision-panel merge-form" onSubmit={onSubmitMerge}>
                  <h3>Merge Decision</h3>
                  <label>Merge Strategy</label>
                  <select value={strategy} onChange={(event) => setStrategy(event.target.value as MergeStrategy)}>
                    <option value="replace" disabled={mergeTargetOptions.length === 0}>Replace</option>
                    <option value="append" disabled={mergeTargetOptions.length === 0}>Append</option>
                    <option value="keep_both">Keep Both</option>
                  </select>
                  <div className="strategy-guide">
                    <p><strong>Replace:</strong> {STRATEGY_GUIDE.replace}</p>
                    <p><strong>Append:</strong> {STRATEGY_GUIDE.append}</p>
                    <p><strong>Keep Both:</strong> {STRATEGY_GUIDE.keep_both}</p>
                  </div>

                  {strategy !== "keep_both" ? (
                    <>
                      <label>Target Story</label>
                      <p className="field-hint">Required for replace/append.</p>
                      <div className="readonly-target-story">
                        {selectedMergeTargetLabel || "No target story available"}
                      </div>
                      {mergeTargetOptions.length === 0 ? (
                        <p className="field-hint">No target available. Use Keep Both.</p>
                      ) : null}
                    </>
                  ) : null}

                  {mergeTargetOptions.length === 0 ? (
                    <div className="merge-status-warning">
                      Replace/Append need a target story. Keep Both is available now.
                    </div>
                  ) : null}

                  <div className="required-block">
                    <label>Mandatory Change Note</label>
                    <p className="field-hint">Minimum 8 characters. Explain why this merge strategy is correct.</p>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Explain why this merge strategy is correct"
                    />
                  </div>

                  <button type="submit" disabled={!canSubmit}>
                    {busy ? "Merging..." : "Accept Merge"}
                  </button>
                </form>

                <form className="decision-panel merge-form" onSubmit={onSubmitRepair}>
                  <h3>Run Repair</h3>
                  <div className="required-block">
                    <label>Mandatory Repair Note</label>
                    <p className="field-hint">Minimum 8 characters. Record why this version needs repair before it returns to circulation.</p>
                    <textarea
                      value={repairNote}
                      onChange={(event) => setRepairNote(event.target.value)}
                      placeholder="Explain why this repair is needed"
                    />
                  </div>
                  <button type="submit" disabled={!canRepair}>
                    {busyRepair ? "Repairing..." : "Run Repair"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state">No queued records found. Submit a new ingestion batch to populate the editor review queue.</div>
          )}
        </div>
      </div>
    </section>
  );
}
