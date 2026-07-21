// Typed access to public (browser-exposed) environment variables.
// NEXT_PUBLIC_* values are inlined at build time.
export const env = {
  /**
   * Base path the repository layer talks to: the in-app mock server in
   * TEST_MODE, otherwise `NEXT_PUBLIC_API_BASE`
   * (api.upstat.cuesoft.io once the HTTP surfaces land).
   */
  apiBase: process.env.NEXT_PUBLIC_API_BASE || "/api/mock",
  /** Opt-in product analytics (models/analytics.ts; never on in TEST_MODE). */
  analytics: process.env.NEXT_PUBLIC_ANALYTICS === "1",
  /** gRPC-Web endpoint (Envoy) for the X-8 control-plane client. */
  envoyUrl: process.env.NEXT_PUBLIC_ENVOY_URL || "http://localhost:8082",
  /**
   * TEST_MODE (web-standard): NEXT_PUBLIC_TEST_MODE=1 →
   * - GoogleAuthButton signs straight in (no Firebase), and
   * - the repository client targets the in-app mock server (/api/mock).
   */
  testMode: process.env.NEXT_PUBLIC_TEST_MODE === "1",
} as const;
