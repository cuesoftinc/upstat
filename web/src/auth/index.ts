import type { AuthProvider } from "./provider";
import { env } from "@/config/env";
import { SsoAuthProvider } from "./sso-provider";
import { TestModeAuthProvider } from "./test-mode-provider";

export type { AuthProvider, AuthUser } from "./provider";
export { SsoAuthProvider } from "./sso-provider";
export { TestModeAuthProvider } from "./test-mode-provider";

let provider: AuthProvider | null = null;

/** Active auth provider: TEST_MODE uses the deterministic one, otherwise Google SSO through the API. */
export function getAuthProvider(): AuthProvider {
  if (!provider) {
    provider = env.testMode
      ? new TestModeAuthProvider()
      : new SsoAuthProvider();
  }
  return provider;
}
