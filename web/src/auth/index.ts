import type { AuthProvider } from "./provider";
import { TestModeAuthProvider } from "./test-mode-provider";

export type { AuthProvider, AuthUser } from "./provider";
export { TestModeAuthProvider } from "./test-mode-provider";

let provider: AuthProvider | null = null;

/**
 * Active auth provider. TEST_MODE → TestModeAuthProvider. The real
 * FirebaseAuthProvider (Google-only per X-1) slots in here at
 * backend-integration time — callers never know the difference.
 */
export function getAuthProvider(): AuthProvider {
  if (!provider) {
    // Only TestModeAuthProvider exists in W0; the factory is the seam.
    provider = new TestModeAuthProvider();
  }
  return provider;
}
