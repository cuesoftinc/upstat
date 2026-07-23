import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Quarantined legacy trees — excluded from build & routing per the
    // legacy policy (web-implementation.md §8); retired in dedicated
    // `chore(web): retire legacy <area>` PRs later.
    "src/legacy/**",
    // X-8 exception (§8 tranche 3): the gRPC-Web control-plane client
    // stays in place until monitors-v2 — not UI, not retro-linted.
    "src/models/repositories/grpc-client.ts",
    "src/proto/**",
    "src/components/libs/grpc/**",
  ]),
  // W3 enforcement gate (paired with scripts/check-boundaries.mjs):
  // src/legacy is quarantined — no live import may reach it. The
  // gRPC-Web control-plane client is exempted above (globalIgnores, X-8);
  // these patterns cover the org's pruned/banned styled kits and date
  // libraries (web-implementation.md §8, org SKILL).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/legacy/**", "@/legacy/**"],
              message:
                "src/legacy is quarantined (web-implementation.md §8) — live code must not import it.",
            },
            {
              group: ["@mui/*", "@emotion/*"],
              message:
                "Styled kits are pruned org-wide — build from the token layer (Tailwind + design tokens).",
            },
            {
              group: ["dayjs", "moment"],
              message:
                "Use the native Date-based helpers in @/lib/format — no third-party date library in this repo.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
