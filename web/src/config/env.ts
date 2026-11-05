// Typed access to public (browser-exposed) environment variables.
// NEXT_PUBLIC_* values are inlined at build time.
export const env = {
  /**
   * Base path the repository layer talks to: the in-app mock server in
   * TEST_MODE, otherwise `NEXT_PUBLIC_API_URL`
   * (api-upstat.cuesoft.io once the HTTP surfaces land).
   */
  apiBase: process.env.NEXT_PUBLIC_API_URL || "/api/mock",
  /** Opt-in product analytics (models/analytics.ts; never on in TEST_MODE). */
  analytics: process.env.NEXT_PUBLIC_ANALYTICS === "1",
  /**
   * TEST_MODE (web-standard): NEXT_PUBLIC_TEST_MODE=true →
   * - GoogleAuthButton signs straight in (no Google redirect), and
   * - the repository client targets the in-app mock server (/api/mock).
   */
  testMode: process.env.NEXT_PUBLIC_TEST_MODE === "true",
} as const;

// A production server listens on its own port, so a localhost default
// there would loop back into the proxy.
const localDefault = (url: string) =>
  process.env.NODE_ENV === "production" ? undefined : url;

/**
 * Server-only: where the /api/v1 proxy forwards (src/app/api/v1). Read per
 * request so the same build serves compose and cloud.
 */
export const serverEnv = () => ({
  apiOrigin: process.env.API_URL ?? localDefault("http://localhost:8080"),
  queryOrigin: process.env.QUERY_URL ?? localDefault("http://localhost:8083"),
});
