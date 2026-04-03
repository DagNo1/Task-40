import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { fetchStories, StoryListItem } from "./stories.api";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export function StoriesPage() {
  const { csrfToken } = useAuth();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StoryListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStories(query);
  }, [query]);

  async function loadStories(nextQuery: string) {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStories(nextQuery, csrfToken);
      setItems(rows);
      setSelectedId((current) => (current && rows.some((item) => item.id === current) ? current : rows[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stories");
    } finally {
      setLoading(false);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(queryInput);
  }

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <section className="panel stories-layout">
      <div className="topbar">
        <div>
          <h1>Stories</h1>
          <p className="page-intro">Browse accepted stories and latest updates.</p>
        </div>
      </div>

      <ApiErrorBanner error={error} />

      <form className="stories-search" onSubmit={onSearch}>
        <label>Search by title or URL</label>
        <div className="stories-search-row">
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Type title or canonical URL"
          />
          <button type="submit">Search</button>
        </div>
      </form>

      <div className="stories-grid">
        <div className="stories-table-wrap">
          {loading ? <div className="loading-state">Loading stories.</div> : null}
          {!loading && items.length === 0 ? <div className="empty-state">No stories found for this filter.</div> : null}
          {!loading && items.length > 0 ? (
            <table className="stories-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">URL</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={item.id === selectedId ? "selected" : ""}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td title={item.title}>{item.title}</td>
                    <td title={item.canonicalUrl}>{item.canonicalUrl}</td>
                    <td>{item.source}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <aside className="stories-summary">
          <h3>Selected Story</h3>
          {selected ? (
            <div className="stories-summary-body">
              <p><strong>Title:</strong> {selected.title}</p>
              <p><strong>URL:</strong> {selected.canonicalUrl}</p>
              <p><strong>Source:</strong> {selected.source}</p>
              <p><strong>Status:</strong> {selected.status}</p>
              <p><strong>Latest Version:</strong> {selected.latestVersionNumber ?? "-"}</p>
              <p><strong>Latest Version At:</strong> {formatDate(selected.latestVersionAt)}</p>
              <p><strong>Created:</strong> {formatDate(selected.createdAt)}</p>
              <p><strong>Updated:</strong> {formatDate(selected.updatedAt)}</p>
            </div>
          ) : (
            <div className="empty-state">Select a story to view summary.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
