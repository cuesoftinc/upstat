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
  currentUser(): AuthUser | null;
  /** Bearer token for repository calls; null when signed out. */
  idToken(): Promise<string | null>;
}
