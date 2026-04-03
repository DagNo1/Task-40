import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";
import { enrollMfa, fetchMe, verifyMfa } from "./security.api";

export function SecurityPage() {
  const { csrfToken, refreshSession } = useAuth();
  const [me, setMe] = useState<{ username: string; mfaEnabled: boolean } | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadMe();
  }, []);

  async function loadMe() {
    try {
      setLoading(true);
      const profile = await fetchMe(csrfToken);
      setMe({ username: profile.username, mfaEnabled: profile.mfaEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security profile");
    } finally {
      setLoading(false);
    }
  }

  async function onEnroll() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const payload = await enrollMfa(csrfToken);
      setOtpauth(payload.otpauth);
      setStatus("Enrollment secret generated. Add it to your authenticator app, then verify.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll MFA");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const payload = await verifyMfa(code.trim(), csrfToken);
      if (payload.status !== "ok") {
        setError(`MFA verification result: ${payload.status}`);
        return;
      }
      setCode("");
      setStatus("MFA enabled successfully.");
      await loadMe();
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify MFA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-layout">
      <div className="topbar">
        <div>
          <h1>Security Settings</h1>
          <p className="page-intro">Enroll TOTP for this local account and verify the device before it becomes required at sign-in.</p>
        </div>
      </div>

      <ApiErrorBanner error={error} />
      {status ? <p className="success-text">{status}</p> : null}
      {loading ? <div className="loading-state">Loading account security profile.</div> : null}

      <div className="admin-card section-stack">
        <h3>Account Security</h3>
        <p>User: {me?.username ?? "-"}</p>
        <p>MFA Status: {me?.mfaEnabled ? "Enabled" : "Not enabled"}</p>
        <button onClick={() => void onEnroll()} disabled={busy}>
          {busy ? "Working..." : "Enroll MFA"}
        </button>
      </div>

      <form className="admin-card form-stack" onSubmit={onVerify}>
        <h3>Verify Authenticator Code</h3>
        <p className="field-hint">Enter the current code from your authenticator after scanning or copying the provisioning URI.</p>
        <label>One-time code</label>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          minLength={6}
          maxLength={12}
        />
        <button type="submit" disabled={busy || code.trim().length < 6}>
          {busy ? "Verifying..." : "Verify and Enable MFA"}
        </button>
      </form>

      {otpauth ? (
        <div className="admin-card form-stack">
          <h3>Authenticator Provisioning URI</h3>
          <textarea value={otpauth} readOnly />
        </div>
      ) : null}
    </section>
  );
}
