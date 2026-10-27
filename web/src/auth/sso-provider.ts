import type { AuthProvider, AuthUser } from "./provider";
import {
  clearToken,
  readStoredToken,
  requestLogout,
  startGoogleSignIn,
} from "./sso-client";

interface SessionPayload {
  userId?: string;
  email?: string;
  name?: string;
  exp?: number;
}

function decodePayload(token: string): SessionPayload | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Real auth: the API runs Google SSO and hands back its own session token,
 * which lives in per-tab sessionStorage and rides as the bearer token.
 */
export class SsoAuthProvider implements AuthProvider {
  signInWithGoogle(): Promise<AuthUser> {
    // Leaves the page for Google; the callback route finishes the session.
    return startGoogleSignIn().then(() => new Promise<AuthUser>(() => {}));
  }

  async signOut(): Promise<void> {
    const token = readStoredToken();
    clearToken();
    await requestLogout(token);
  }

  currentUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    const token = readStoredToken();
    if (!token) return null;
    const payload = decodePayload(token);
    const id = payload?.userId;
    if (!payload || !id || !payload.email) return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now())
      return null;
    return { id, email: payload.email, name: payload.name || payload.email };
  }

  async idToken(): Promise<string | null> {
    return this.currentUser() ? readStoredToken() : null;
  }
}
