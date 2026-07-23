# Upstat Web (`web`)

Next.js 16 (App Router, TypeScript, Tailwind CSS v4 + token CSS variables)
front-end: marketing home at `/`, a 12-pillar observability dashboard at
`/dashboard` (per the NavRail — Home, Dashboards, Metrics, Logs, Traces, RUM,
Synthetics/Uptime, Monitors, Incidents, SLOs, Service Catalog, Settings), and
Google sign-in at `/signin`.

## Run

From the repo root (recommended): `make up` → http://localhost:3000

Dev server:

```bash
npm install
npm run dev
```

`NEXT_PUBLIC_*` values are inlined at build time — set them in the root
`.env` (see `.env.example`). See `web/src/config/env.ts` for the full list:

- `NEXT_PUBLIC_API_BASE` — base path the repository layer talks to (defaults
  to the in-app mock server, `/api/mock`).
- `NEXT_PUBLIC_ANALYTICS` — opt-in product analytics (`1` to enable; never on
  in `TEST_MODE`).
- `NEXT_PUBLIC_ENVOY_URL` — gRPC-Web endpoint (Envoy) for the retained,
  not-yet-wired control-plane client.
- `NEXT_PUBLIC_TEST_MODE` — `1` signs straight in (no Firebase) and targets
  the in-app mock server; used by local dev and Playwright.

Node version: see `.nvmrc`.
