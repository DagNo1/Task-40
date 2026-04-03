import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { IngestionResult, submitUrlBatch, uploadIngestionFile } from "./ingestion.api";

function parseUrls(raw: string): string[] {
  return raw
    .split(/[,\n]/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function IngestionPage() {
  const { csrfToken } = useAuth();
  const [source, setSource] = useState("wire");
  const [file, setFile] = useState<File | null>(null);
  const [urlSource, setUrlSource] = useState("wire");
  const [urlBatchText, setUrlBatchText] = useState("");
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyUrlBatch, setBusyUrlBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);

  const parsedUrls = useMemo(() => parseUrls(urlBatchText), [urlBatchText]);

  async function onSubmitUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Please choose a feed file before uploading.");
      return;
    }

    setBusyUpload(true);
    try {
      const payload = await uploadIngestionFile({ source: source.trim(), file }, csrfToken);
      setResult(payload);
      setFile(null);
      setSuccess("Feed file ingested successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feed upload failed");
    } finally {
      setBusyUpload(false);
    }
  }

  async function onSubmitUrlBatch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (parsedUrls.length === 0) {
      setError("Please provide at least one URL.");
      return;
    }

    setBusyUrlBatch(true);
    try {
      const payload = await submitUrlBatch({ source: urlSource.trim(), urls: parsedUrls }, csrfToken);
      setResult(payload);
      setUrlBatchText("");
      setSuccess(`Submitted ${parsedUrls.length} URL${parsedUrls.length === 1 ? "" : "s"} for ingestion.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "URL batch ingest failed");
    } finally {
      setBusyUrlBatch(false);
    }
  }

  return (
    <section className="panel ingestion-layout">
      <div className="topbar">
        <div>
          <h1>Ingestion Workspace</h1>
          <p className="page-intro">Upload source files or submit URL batches for cleansing, clustering, and editor review.</p>
        </div>
      </div>

      <ApiErrorBanner error={error} />
      {success ? <p className="success-text">{success}</p> : null}

      <div className="ingestion-grid">
        <form className="admin-card form-stack" onSubmit={onSubmitUpload}>
          <h3>Feed File Upload</h3>
          <p className="field-hint">Accepted formats: XML, JSON, and CSV feed exports.</p>
          <label>Source</label>
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="wire" />

          <label>File (XML, JSON, CSV)</label>
          <input
            type="file"
            accept=".xml,.json,.csv,text/csv,application/json,application/xml,text/xml"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />

          <button type="submit" disabled={busyUpload}>
            {busyUpload ? "Uploading..." : "Upload Feed File"}
          </button>
        </form>

        <form className="admin-card form-stack" onSubmit={onSubmitUrlBatch}>
          <h3>URL Batch Intake</h3>
          <p className="field-hint">Paste newline- or comma-separated URLs from approved sources.</p>
          <label>Source</label>
          <input value={urlSource} onChange={(event) => setUrlSource(event.target.value)} placeholder="wire" />

          <label>URLs (newline or comma separated)</label>
          <textarea
            value={urlBatchText}
            onChange={(event) => setUrlBatchText(event.target.value)}
            placeholder="https://source-a/story-1\nhttps://source-b/story-2"
          />
          <small>{parsedUrls.length} URL(s) parsed</small>

          <button type="submit" disabled={busyUrlBatch}>
            {busyUrlBatch ? "Submitting..." : "Submit URL Batch"}
          </button>
        </form>
      </div>

      {result ? (
        <div className="admin-card section-stack">
          <h3>Pipeline Summary</h3>
          <p>Accepted: {result.accepted}</p>
          <p>Rejected: {result.rejected}</p>
          <p>Duplicates Flagged: {result.duplicates}</p>
          <p>Anomalies Flagged: {result.anomalies}</p>
          {result.thresholds ? (
            <p>
              Thresholds: SimHash {result.thresholds.simhashMaxHamming}, MinHash{" "}
              {result.thresholds.minhashMinSimilarity}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
