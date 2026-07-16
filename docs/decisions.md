# Upstat — Decision Sheet

> Ratify by checking a box; each decision flips its **[Proposed]** tags to
> **[Decided]** and unblocks the listed phases. Status: ☐ open · ☑ ratified.

> **RATIFIED 2026-07-16** — all recommendations approved wholesale ("decisions
> look solid"). Where other docs still carry **[Proposed]** on these topics,
> this sheet governs; tags flip to **[Decided]** as docs are next touched.

## U-1 · Unified telemetry store (R2) — gates Phases 3–7 (every pillar)

| Option | For | Against |
| --- | --- | --- |
| **(a) ClickHouse — one columnar store for metrics + logs + traces; Mongo stays control-plane** ⭐ | The Signoz/HyperDX-proven pattern; one system to operate; excellent compression + TTLs; self-host = one more container | New operational skill to build |
| (b) VictoriaMetrics + OpenSearch split | Best-of-breed per signal | Two stateful systems to run + query-layer complexity |
| (c) Stretch MongoDB | No new infra | Falls over on high-cardinality timeseries + log search; would poison every pillar |

**Also ratify with it:** self-host compose gains a `clickhouse` service; helm
documents external-or-StatefulSet options (same stance as Mongo today).

☑ Ratified: option (a) ClickHouse

## U-2 · Browser event auth (ANA-001) — gates Phase 1 (events layer, "D2")

**Recommendation ⭐:** public **write-only property key** + origin allowlist +
per-key rate limits + closed event/dims schema; `visitor_hash` computed
server-side. This is the standard cookieless-analytics posture
(Plausible/Fathom-class). No cookies, no raw IPs at rest.

☑ Ratified

## U-3 · Cookieless visitor model — privacy-defining, published in UPS-005

**Recommendation ⭐:** `visitor_hash = hash(daily_salt, property, ip, UA)`;
salt rotates daily; raw IP never stored; uniques are approximate and
documented as such; no cross-property joins, ever.

☑ Ratified

## U-4 · Alert channels & email provider (MON-001) — gates Phase 2

**Recommendation ⭐:** **webhooks first** (provider-independent, ships
immediately), **email via Resend** second (developer-grade DX, sane pricing;
SES is the cost-optimization escape hatch later); Slack via webhook URL
initially, native app later.

☑ Ratified: email provider Resend

## U-5 · Protocol split — gates all new surfaces

**Recommendation ⭐:** existing user/monitor control plane stays **gRPC**
(works, typed, Envoy already wired); every new surface is **HTTP/JSON**
(events, stats, query, OTLP/HTTP alongside OTLP/gRPC, dashboards, monitors-v2,
incidents, SLOs). Browsers and sibling products never need proto toolchains.

☑ Ratified

## U-6 · Retention defaults per signal — published per UPS-003

**Recommendation ⭐:** raw events 90d · hourly rollups 90d · daily rollups
13mo · check results 90d · incidents indefinite · metrics 13mo
(rollup-thinned) · logs 15d hot (archive later) · traces 7d sampled.

☑ Ratified as recommended

## U-7 · Brand & theme (sampled 2026-07-16)

**Recommendation ⭐:** brand **#00E09E** + `brand-deep` **#00A991** (sampled
from the existing landing, now in `upstat/tokens`); dashboards **default
dark**, light supported; `ok` green kept visually distinct from brand teal.
Effectively already true — ratifying makes it official.

☑ Ratified

## U-8 · Insight narrative LLM (added 2026-07-16)

**Ratified via X-4:** the observability insight renderer (currently Groq,
`service/groq_renderer.py`) migrates to **Vertex AI** in cloud deployments;
GROQ_API_KEY remains the self-host fallback. Scheduled with the next
observability-service touch, not as its own phase.

☑ Ratified

## Cross-cutting

- **X-1 account.cuesoft.io / identity (RATIFIED)**: interim + sandbox identity
  is **Firebase Authentication on GCP project `sandbox-e306a`** ("sandbox") —
  Google sign-in + email flows come from Firebase; services verify Firebase ID
  tokens (OIDC-compatible). `account.cuesoft.io` **is not built yet** — each app replicates the
  sign-in/sign-up screens **in-app** (own UI per its design system,
  Firebase Auth underneath: Google sign-in + email/password flows). The
  central facade fronts the same Firebase project later without contract
  changes; in-app screens then become optional, not obsolete. **HARDENED
  2026-07-16: Google sign-in is the ONLY method — no username/password
  signup or login, product-wide.** Email/Password provider disabled at
  the Firebase project; backends reject non-Google-provider tokens
  (`provider-not-allowed`); UI ships exactly one auth CTA. Full contract:
  [flows/auth.md](flows/auth.md). Environment/secrets live in **Doppler**
  (`cueprise/cuesoft_stg`; see also the `cuesoft-iac` project) — CLI token
  currently expired (`doppler login` to refresh); config names to be mirrored
  into docs once readable. ☑
- **X-2 Docs platform**: GitBook space per product, Git-synced; Scalar API
  refs. ☑
- **X-3 Cloud deployment target (RATIFIED, directive)**: all backend
  services run on **Google Cloud Run** (per-service containers — the same
  `cuesoft/<repo>-<service>` images), following the cueprise pattern
  (IaC precedent in `cuesoft-iac`); frontends deploy to **Firebase App
  Hosting**. Helm + terraform in `deploy/` remain the **self-host** path —
  cloud and self-host share images, not manifests. ☑
- **X-4 AI platform (RATIFIED, directive 2026-07-16)**: AI features use
  **Vertex AI** (Gemini via `{region}-aiplatform.googleapis.com`, ADC from the
  service account — the `cuesoft-iac/functions/cueprise-gemini-proxy` pattern;
  reference model `gemini-2.5-flash-lite`, region `us-central1`). No
  consumer-API keys to third-party AI vendors in cloud deployments — data
  stays inside GCP, which strengthens every privacy disclosure. Self-host
  fallback: bring-your-own Gemini/Groq key via env (existing code path). ☑
