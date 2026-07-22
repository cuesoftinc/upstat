/**
 * AuthProvider — the seam behind the single Google CTA (X-1, flows/auth.md:
 * Google sign-in only, product-wide; Firebase-backed in production).
 *
 * TEST_MODE ships TestModeAuthProvider; FirebaseAuthProvider lands at
 * backend-integration time behind the same interface.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface AuthProvider {
  /** The one sign-in path this product has (X-1). Resolves once a session exists. */
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  /**
   * Synchronous snapshot of the current session (null = signed out).
   * Contract (flows/auth.md §2, ratified 2026-07-22): a failed session
   * read reads as **signed out** — implementations return `null` on any
   * failure and MUST NOT throw; the controllers still catch as a second
   * net so a misbehaving provider can never strand a guard at its
   * loading state.
   */
  currentUser(): AuthUser | null;
  /** Bearer token for repository calls; null when signed out. */
  idToken(): Promise<string | null>;
}
