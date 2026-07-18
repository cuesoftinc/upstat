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
    // legacy policy; retired in dedicated PRs later.
    "src/legacy/**",
    // Live legacy trees (pre-W0 app; W3 quarantine targets). They predate
    // CI and carry pre-existing lint errors — new-system code stays fully
    // linted, legacy is not retro-fixed (it gets replaced, not patched).
    "src/app/dashboard/**",
    "src/app/api/dashboard/**",
    "src/app/page.tsx",
    "src/app/not-found.tsx",
    "src/app/not-found.styles.ts",
    "src/client.ts",
    "src/proto/**",
    "src/data/**",
    "src/types/**",
    "src/components/**",
    "!src/components/ui",
    "!src/components/ui/*.tsx",
  ]),
]);

export default eslintConfig;
