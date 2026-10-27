import { env } from "@/config/env";
import { SsoRequestError } from "./oauth-errors";

const VERIFIER_KEY = "upstat.sso-verifier";
const TOKEN_KEY = "upstat.session";
const VERIFIER_TTL_MS = 10 * 60 * 1000;
const HANDOFF_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RETRY_DELAYS_MS = [0, 1000, 3000, 7000];
const REQUEST_TIMEOUT_MS = 15_000;

interface StoredVerifier {
  version: 1;
  verifier: string;
  owner: string;
  createdAt: number;
  expiresAt: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

function newVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function storeVerifier(verifier: string): void {
  const now = Date.now();
  const record: StoredVerifier = {
    version: 1,
    verifier,
    owner: window.location.origin,
    createdAt: now,
    expiresAt: now + VERIFIER_TTL_MS,
  };
  window.sessionStorage.setItem(VERIFIER_KEY, JSON.stringify(record));
}

/** Reads and clears the committed verifier; null when absent, expired or from another origin. */
export function takeVerifier(): string | null {
  const raw = window.sessionStorage.getItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as StoredVerifier;
    if (
      record.version !== 1 ||
      record.owner !== window.location.origin ||
      record.expiresAt < Date.now()
    ) {
      return null;
    }
    return typeof record.verifier === "string" ? record.verifier : null;
  } catch {
    return null;
  }
}

export function isValidHandoff(value: string | null): value is string {
  return value !== null && HANDOFF_PATTERN.test(value);
}

export function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked; there is nothing to clear then.
  }
}

/** Commits a fresh PKCE verifier and leaves the page for the API's Google redirect. */
export async function startGoogleSignIn(): Promise<void> {
  const verifier = newVerifier();
  storeVerifier(verifier);
  const params = new URLSearchParams({ cv: await pkceChallenge(verifier) });
  if (process.env.NODE_ENV === "development")
    params.set("return_to", window.location.origin);
  window.location.assign(
    `${env.apiBase}/v1/auth/sso/google?${params.toString()}`,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function exchangeOnce(
  handoff: string,
  verifier: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${env.apiBase}/v1/auth/sso/exchange`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoff, verifier }),
      signal: controller.signal,
    });
  } catch {
    throw new SsoRequestError(0, "network_error");
  } finally {
    clearTimeout(timer);
  }
  const body = (await response.json().catch(() => null)) as {
    data?: { access_token?: string };
    error?: { code?: string };
  } | null;
  const token = body?.data?.access_token;
  if (!response.ok || !token) {
    throw new SsoRequestError(
      response.status,
      body?.error?.code ?? "exchange_failed",
    );
  }
  return token;
}

/** Trades the one-time handoff for a session token, retrying only network and server failures. */
export async function exchangeHandoff(
  handoff: string,
  verifier: string,
): Promise<string> {
  let last: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    try {
      return await exchangeOnce(handoff, verifier);
    } catch (error) {
      last = error;
      if (
        !(error instanceof SsoRequestError) ||
        (error.status !== 0 && error.status < 500)
      )
        throw error;
    }
  }
  throw last;
}

/** Best-effort server logout; local state is cleared by the caller regardless. */
export async function requestLogout(token: string | null): Promise<void> {
  try {
    await fetch(`${env.apiBase}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // The session cookie also expires on its own.
  }
}
