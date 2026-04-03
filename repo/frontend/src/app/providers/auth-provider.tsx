import React, { createContext, useContext, useMemo, useState } from "react";
import { apiRequest, apiVersion } from "../../services/api/client";
import { AuthContextValue, AuthSession } from "../../types/auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      csrfToken,
      login: async (username, password, totpCode) => {
        const payload = await apiRequest<{
          status: string;
          csrfToken?: string;
        }>(apiVersion, "/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password, totpCode })
        });

        if (payload.status === "ok") {
          const me = await apiRequest<AuthSession>(
            apiVersion,
            "/auth/me"
          );
          setSession(me);
          const nextToken = payload.csrfToken ?? null;
          setCsrfToken(nextToken);
        }
        return { status: payload.status };
      },
      logout: async () => {
        await apiRequest(apiVersion, "/auth/logout", { method: "POST" }, csrfToken);
        setSession(null);
        setCsrfToken(null);
      },
      refreshSession: async () => {
        const me = await apiRequest<AuthSession>(apiVersion, "/auth/me");
        setSession(me);
        const csrfPayload = await apiRequest<{ csrfToken: string }>(apiVersion, "/auth/csrf");
        setCsrfToken(csrfPayload.csrfToken);
      }
    }),
    [csrfToken, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("Auth context unavailable");
  }
  return context;
}
