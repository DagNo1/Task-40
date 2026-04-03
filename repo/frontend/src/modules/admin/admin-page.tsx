import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import {
  fetchAdminOverview,
  fetchPermissionSensitiveOperations,
  setThreshold,
  setUserRateLimit,
  setUserRoles,
  upsertRole
} from "./admin.api";

function formatAuditTimestamp(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

export function AdminPage() {
  const { csrfToken } = useAuth();
  const [overview, setOverview] = useState<any | null>(null);
  const [ops, setOps] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rateLimitRpm, setRateLimitRpm] = useState("60");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedUserRoleIds, setSelectedUserRoleIds] = useState<string[]>([]);
  const [thresholdKey, setThresholdKey] = useState("SIMHASH_MAX_HAMMING");
  const [thresholdValue, setThresholdValue] = useState("8");
  const [roleName, setRoleName] = useState("editor");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>(["stories.review"]);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const data = await fetchAdminOverview(csrfToken);
      setOverview(data);
      if (!selectedUserId) {
        setSelectedUserId(data.users[0]?.id ?? "");
      }
      const operations = await fetchPermissionSensitiveOperations({}, csrfToken);
      setOps(operations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!overview || !selectedUserId) {
      return;
    }
    const user = overview.users.find((row: any) => row.id === selectedUserId);
    if (!user) {
      return;
    }
    setSelectedUserRoleIds(user.roleIds ?? []);
    setRateLimitRpm(String(user.requestsPerMinute ?? 60));
  }, [overview, selectedUserId]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (!selectedRoleId) {
      setRoleDescription("");
      setRoleName("editor");
      setSelectedPermissionKeys(["stories.review"]);
      return;
    }

    const role = overview.roles.find((row: any) => row.id === selectedRoleId);
    if (!role) {
      return;
    }
    setRoleName(role.name);
    setRoleDescription(role.description ?? "");
    setSelectedPermissionKeys(role.permissionKeys ?? []);
  }, [overview, selectedRoleId]);

  async function submit(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin action failed");
    }
  }

  async function onRateLimit(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    await submit(() =>
      setUserRateLimit(
        selectedUserId,
        { requestsPerMinute: Number.parseInt(rateLimitRpm, 10), changeNote: note },
        csrfToken
      )
    );
  }

  async function onThreshold(event: FormEvent) {
    event.preventDefault();
    await submit(() => setThreshold(thresholdKey, { value: thresholdValue, changeNote: note }, csrfToken));
  }

  async function onRole(event: FormEvent) {
    event.preventDefault();
    await submit(() =>
      upsertRole(
        {
          roleId: selectedRoleId || undefined,
          name: roleName,
          description: roleDescription,
          permissionKeys: selectedPermissionKeys,
          changeNote: note
        },
        csrfToken
      )
    );
  }

  async function onUserRoles(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId || !overview) {
      return;
    }
    await submit(() => setUserRoles(selectedUserId, { roleIds: selectedUserRoleIds, changeNote: note }, csrfToken));
  }

  function togglePermission(key: string) {
    setSelectedPermissionKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    );
  }

  function toggleUserRole(roleId: string) {
    setSelectedUserRoleIds((current) =>
      current.includes(roleId) ? current.filter((value) => value !== roleId) : [...current, roleId]
    );
  }

  return (
    <section className="panel admin-layout">
      <div className="topbar">
        <div>
          <h1>Admin Workspace</h1>
          <p className="page-intro">Manage permissions, local controls, and threshold policies with explicit change notes.</p>
        </div>
      </div>
      <ApiErrorBanner error={error} />

      {loading ? <div className="loading-state">Loading admin overview and sensitive operations.</div> : null}

      <div className="required-block">
        <label>Mandatory change note</label>
        <p className="field-hint">Required for role, permission, rate-limit, and threshold updates.</p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Record the reason for this admin change"
        />
      </div>

      <section className="admin-section">
        <h2 className="section-heading">Access & roles</h2>
        <div className="admin-grid">
          <form className="admin-card" onSubmit={onUserRoles}>
            <div className="admin-card-fields">
              <h3>Assign User Roles</h3>
              <label>User</label>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {(overview?.users ?? []).map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <p className="field-hint">Select one or more roles for this user.</p>
              <div className="checkbox-list">
                {(overview?.roles ?? []).map((role: any) => (
                  <label key={role.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedUserRoleIds.includes(role.id)}
                      onChange={() => toggleUserRole(role.id)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={note.trim().length < 8 || selectedUserRoleIds.length === 0}>
                Save User Roles
              </button>
            </div>
          </form>

          <form className="admin-card" onSubmit={onRateLimit}>
            <div className="admin-card-fields">
              <h3>Per-user Rate Limit (default 60 req/min)</h3>
              <label>User</label>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {(overview?.users ?? []).map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <label>Requests per minute</label>
              <input value={rateLimitRpm} onChange={(event) => setRateLimitRpm(event.target.value)} />
              <p className="field-hint">Use a positive integer value.</p>
              <button type="submit" disabled={note.trim().length < 8}>
                Set Rate Limit
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="section-heading">Role definitions & thresholds</h2>
        <div className="admin-grid">
          <form className="admin-card" onSubmit={onRole}>
            <div className="admin-card-fields">
              <h3>Manage Roles & Permissions</h3>
              <label>Role profile</label>
              <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
                <option value="">Create new role</option>
                {(overview?.roles ?? []).map((role: any) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <label>Role name</label>
              <input value={roleName} onChange={(event) => setRoleName(event.target.value)} />
              <label>Description</label>
              <input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} />
              <label>Permissions</label>
              <div className="checkbox-list">
                {(overview?.permissions ?? []).map((permission: any) => (
                  <label key={permission.key} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedPermissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                    />
                    <span>{permission.key}</span>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={note.trim().length < 8 || selectedPermissionKeys.length === 0}>
                Save Role
              </button>
            </div>
          </form>

          <form className="admin-card" onSubmit={onThreshold}>
            <div className="admin-card-fields">
              <h3>Threshold Configuration</h3>
              <label>Threshold key</label>
              <select value={thresholdKey} onChange={(event) => setThresholdKey(event.target.value)}>
                <option value="SIMHASH_MAX_HAMMING">SIMHASH_MAX_HAMMING</option>
                <option value="MINHASH_MIN_SIMILARITY">MINHASH_MIN_SIMILARITY</option>
                <option value="LICENSED_STORY_BUNDLE_CENTS">LICENSED_STORY_BUNDLE_CENTS</option>
                <option value="DEFAULT_RATE_LIMIT_RPM">DEFAULT_RATE_LIMIT_RPM</option>
              </select>
              <label>Value</label>
              <input value={thresholdValue} onChange={(event) => setThresholdValue(event.target.value)} />
              <button type="submit" disabled={note.trim().length < 8}>
                Save Threshold
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="section-heading">Audit trail</h2>
        <div className="admin-card admin-operations">
          <h3>Permission-sensitive Operations</h3>
          <div className="admin-operations-table">
            {ops.length === 0 && !loading ? (
              <div className="empty-state">No permission-sensitive operations recorded yet. Admin changes will appear here.</div>
            ) : (
              <table className="admin-ops-table">
                <thead>
                  <tr>
                    <th scope="col">Timestamp</th>
                    <th scope="col">Event Type</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.map((item) => (
                    <tr key={item.id}>
                      <td className="admin-ops-time">{formatAuditTimestamp(item.createdAt)}</td>
                      <td className="admin-ops-event" title={item.actionType}>{item.actionType || "—"}</td>
                      <td className="admin-ops-note" title={item.notes}>{item.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
