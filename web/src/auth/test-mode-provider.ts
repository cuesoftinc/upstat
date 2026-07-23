import type { AuthProvider, AuthUser } from "./provider";

const TEST_USER: AuthUser = {
  id: "usr_ibukun",
  name: "Ibukun",
  email: "ibukun@cuesoft.io",
};

// Fleet canon (P16): TEST_MODE session keys are `<product>.test-session`;
// upstat keeps sessionStorage (already the dictated storage).
const STORAGE_KEY = "upstat.test-session";

/**
 * TEST_MODE auth (`NEXT_PUBLIC_TEST_MODE=1`): no Firebase, no network —
 * sign-in immediately establishes a deterministic session so Playwright and
 * local dev go straight from /signin to /dashboard.
 */
export class TestModeAuthProvider implements AuthProvider {
  async signInWithGoogle(): Promise<AuthUser> {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_USER));
    }
    return TEST_USER;
  }

  async signOut(): Promise<void> {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  currentUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      // flows/auth.md §2: a corrupted session reads as signed out — the
      // provider contract (provider.ts) is null, never throw.
      return null;
    }
  }

  async idToken(): Promise<string | null> {
    return this.currentUser() ? "test-mode-token" : null;
  }
}
