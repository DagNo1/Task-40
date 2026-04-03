import { CookieOptions } from "express";

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function resolveSameSite(): "strict" | "lax" | "none" {
  const raw = (process.env.SESSION_COOKIE_SAMESITE ?? "strict").trim().toLowerCase();
  if (raw === "lax" || raw === "none") {
    return raw;
  }
  return "strict";
}

export function resolveSessionCookieOptions(): CookieOptions {
  const isLocalDevelopment =
    (process.env.NODE_ENV ?? "").trim().toLowerCase() === "development" ||
    parseBoolean(process.env.SESSION_COOKIE_LOCAL_DEV) === true;

  let secure = !isLocalDevelopment;
  const secureOverride = parseBoolean(process.env.SESSION_COOKIE_SECURE);
  if (secureOverride !== undefined) {
    secure = secureOverride;
  }

  const sameSite = resolveSameSite();
  if (sameSite === "none") {
    secure = true;
  }

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/"
  };
}
