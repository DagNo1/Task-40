export interface AuthSession {
  userId: string;
  username?: string;
  roles: string[];
  permissions: string[];
  mfaEnabled?: boolean;
}

export interface AuthContextValue {
  session: AuthSession | null;
  csrfToken: string | null;
  login: (username: string, password: string, totpCode?: string) => Promise<{ status: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
