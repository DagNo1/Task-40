import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { ApiErrorBanner } from "../../components/feedback/api-error-banner";

export function LoginPage() {
  const { login, session } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (session) {
    return <Navigate to="/editor-queue" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("");
    try {
      const result = await login(username, password, totpCode || undefined);
      setStatus(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <span className="sidebar-kicker muted-kicker">Local Access</span>
        <h1>SentinelDesk Login</h1>
        <p className="page-intro">Use your local newsroom credentials to access editorial, finance, and audit workflows.</p>
        <ApiErrorBanner error={error} />
        <form onSubmit={onSubmit}>
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
          <label>Password</label>
          <div className="input-with-icon">
            <input
              value={password}
              type={showPassword ? "text" : "password"}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
          <label>Offline TOTP (optional)</label>
          <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
          <button type="submit">Sign In</button>
        </form>
        <p className="login-footnote">Password policy: minimum 12 characters. Sessions are idle-expiring and support optional TOTP.</p>
        <p className="status-line">Status: {status || "idle"}</p>
      </div>
    </div>
  );
}
