export type ApiVersion = "v1" | "v2";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
const envApiVersion = import.meta.env.VITE_API_VERSION;

export const apiVersion: ApiVersion = envApiVersion === "v2" ? "v2" : "v1";

export async function apiRequest<T>(
  version: ApiVersion,
  path: string,
  init: RequestInit = {},
  csrfToken?: string | null
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const method = (init.method ?? "GET").toUpperCase();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${version}${path}`, {
      ...init,
      headers,
      credentials: "include"
    });
  } catch {
    throw new Error("Network error: unable to reach API");
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (isJson) {
      throw new Error((body as { message?: string } | null)?.message ?? `Request failed (${response.status})`);
    }

    const text = typeof body === "string" ? body.trim() : "";
    throw new Error(text || `Request failed (${response.status})`);
  }

  return body as T;
}
