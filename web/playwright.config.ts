import { defineConfig, devices } from "@playwright/test";

/**
 * E2E harness — runs in TEST_MODE against the in-app mock server
 * (web standard: Playwright journeys mirror design.md §8.4, TEST_MODE only).
 */
// upstat-reserved (3100 collides with sibling repos); env-overridable so
// parallel local lanes can isolate their runs (CI unaffected).
const PORT = Number(process.env.UPSTAT_E2E_PORT ?? 3131);

export default defineConfig({
  testDir: "./e2e",
  // The mock store is one shared, mutable narrative per dev server — the
  // W3 journey mutates it (orgs, incidents), so specs run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_TEST_MODE: "1",
    },
  },
});
