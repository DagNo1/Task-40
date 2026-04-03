import { apiRequest, apiVersion } from "../../services/api/client";

export interface MeResponse {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
}

export async function fetchMe(csrfToken?: string | null): Promise<MeResponse> {
  return apiRequest<MeResponse>(apiVersion, "/auth/me", {}, csrfToken);
}

export async function enrollMfa(csrfToken?: string | null): Promise<{ otpauth: string }> {
  return apiRequest<{ otpauth: string }>(apiVersion, "/auth/mfa/enroll", { method: "POST" }, csrfToken);
}

export async function verifyMfa(code: string, csrfToken?: string | null): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(
    apiVersion,
    "/auth/mfa/verify",
    { method: "POST", body: JSON.stringify({ code }) },
    csrfToken
  );
}
