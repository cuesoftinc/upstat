import type { AuthProvider, AuthUser } from "./provider";

const TEST_USER: AuthUser = {
  id: "usr_ibukun",
  name: "Ibukun",
  email: "ibukun@cuesoft.io",
};

const STORAGE_KEY = "upstat_test_session";

/**
 * TEST_MODE auth (`NEXT_PUBLIC_TEST_MODE=1`): no Firebase, no network —
 * sign-in immediately establishes a deterministic session so Playwright and
 * local dev go straight from /login to the app.
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
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  async idToken(): Promise<string | null> {
    return this.currentUser() ? "test-mode-token" : null;
  }
}
