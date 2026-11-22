import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// .ts suites that touch window storage or render hooks.
const DOM_TS = [
  "src/auth/sso-client.test.ts",
  "src/auth/sso-provider.test.ts",
  "src/auth/test-mode-provider.test.ts",
  "src/controllers/home.test.ts",
];

/**
 * Vitest — the single unit/integration runner; tests co-locate under src/**.
 * Component suites (`.tsx`) and DOM_TS run in jsdom; every other `.ts` suite
 * runs in node. `globals` enables RTL auto-cleanup.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**", "src/legacy/**", "e2e/**"],
    env: {
      NEXT_PUBLIC_TEST_MODE: "true",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: DOM_TS,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", ...DOM_TS],
        },
      },
    ],
  },
});
