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

☑ Ratified: option (a) ClickHouse — **control-plane note revised by X-5:**
the control plane migrates Mongo→**Aiven Postgres**; "Mongo stays" in the
option text is superseded

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

☑ Ratified — **email provider REVISED by X-7 (2026-07-16): Brevo REST API** (was Resend); webhooks-first unchanged

## U-5 · Protocol split — gates all new surfaces

**Recommendation ⭐:** existing user/monitor control plane stays **gRPC**
(works, typed, Envoy already wired); every new surface is **HTTP/JSON**
(events, stats, query, OTLP/HTTP alongside OTLP/gRPC, dashboards, monitors-v2,
incidents, SLOs). Browsers and sibling products never need proto toolchains.

☑ Ratified

## U-6 · Retention defaults per signal — published per UPS-003

**Recommendation ⭐:** raw events 90d · hourly rollups 90d · daily rollups
13mo · check results 90d · incidents indefinite · metrics 13mo
(**rollup ladder: raw 15d → 1m avg 90d → 1h avg 13mo**) · logs 15d hot
(archive later) · traces 7d (**head sampling, default 10%, per-org
configurable; errors always kept — tail sampling later**).

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

## U-9 · Deferred-catalog Wave A (user-ratified; built 2026-07-20)

Six deferred items from the user-ratified catalog shipped in one wave —
the interpretation decisions live where each surface is specced:
**A1** Features pillar-map dropdown (supplements the 4-text-links nav
parity canon; the link inventory is unchanged — pages.md A1) · **§5**
colorblind mode (`upstat.colorvision`, theme-contract persistence;
design.md §5) · **§5** chart data-table toggle (design.md §5) · **B4**
virtualized log stream (bespoke spacer windowing; pages.md B4) · **B9**
postmortem template on resolve (pages.md B9) · **B8** monitors
grouped-by-state view (literal-reading **[Decided 2026-07-20]** line in
pages.md B8). As-built detail: web-implementation.md "Wave A as-built"
blocks.

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
  (`provider_not_allowed`); UI ships exactly one auth CTA. Full contract:
  [flows/auth.md](flows/auth.md). Environment/secrets live in **Doppler**
  — resolved: Doppler access works via the cuesoft-iac token; **services read
  project `upstat`, config `stg`** (dev* = local convenience; prd empty until
  a production exists). Redis DB index recorded when assigned. ☑
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
- **X-5 Data plane (RATIFIED 2026-07-16, per-product DB decided by delegation)**:
  **Aiven Postgres** for the control plane (users, monitors, dashboards,
  rules, incidents, SLOs) — migrating from Mongo with the monitors-v2/OBS
  work; **ClickHouse** remains the telemetry store (U-1 unchanged).
  **Shared Redis**: the sandbox **Aiven Redis** instance, tenancy by
  **`REDIS_DB` index** (the irealty pattern: discrete `REDIS_HOST/PORT/
  USERNAME/PASSWORD/TLS/DB` vars; e.g. irealty prd=0, stg/dev=1) — indices
  per product/config assigned in Doppler by the owner. **Doppler is the env
  source of truth**: project `upstat` with `dev / dev_personal / stg / prd`
  configs (already created). **Object storage**: the **default Cloud Storage bucket** in
  `sandbox-e306a` (per-product prefixes `upstat/<env>/…`) for capture
  media, exports, and artifacts. Self-host compose keeps its bundled
  stores. ☑
- **X-6 Environments & deploy gating (RATIFIED 2026-07-16, deliberate
  deviation from the cueprise norm)**: `stg` = **sandbox** and is the ONLY
  environment — no production deployment exists for these products. Secrets
  live in Doppler `<project>/stg`. Because these repos are **open-source**,
  merge-to-main must NOT deploy: main-merge runs build+test only. **Deploys
  happen exclusively on tag creation (`v*`)**, treated as production-grade:
  a GitHub tag ruleset restricts `v*` creation to owner-level access, and the
  deploy workflow additionally runs in a protected GitHub environment. ☑
- **X-7 Transactional email (RATIFIED, directive 2026-07-16)**: **Brevo REST
  API** for all product email (alert emails, money-event receipts, purge
  confirmations…) — the irealty pattern: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`,
  `BREVO_FROM_NAME` in Doppler. **No SMTP anywhere** — existing SMTP/gomail
  plumbing retires when next touched. Revises U-4's Resend pick where it
  applied. ☑
- **X-8 Protocol standard (RATIFIED 2026-07-16)**: ecosystem APIs are
  **HTTP/JSON**. gRPC exists ONLY where upstat needs it: **OTLP/gRPC ingest**
  (OTel industry standard, OBS-001), internal s2s (observability↔common),
  and the existing monitor control plane until monitors-v2. Cloud Run runs
  gRPC fine with end-to-end HTTP/2 (h2c) — already how api/common works.
  **Browser gRPC-Web + Envoy is a sunset path**: no new surface uses it
  (U-5); at monitors-v2 (OBS-006) the dashboard goes fully HTTP and Envoy
  retires from the cloud topology. apparule/expendit never adopt gRPC. ☑
- **X-9 Telemetry standard (RATIFIED, directive 2026-07-16)**: **OpenTelemetry
  everywhere** — traces, custom metrics, and logs from every service via OTel
  SDKs (Go: otel-go + slog bridge; Python: opentelemetry-python + logging
  handler; Next: @opentelemetry/sdk-node), W3C `traceparent` propagation
  across HTTP and gRPC. **Export: direct OTLP from the SDK in v1** (batch
  processors; collector sidecar on Cloud Run is the documented upgrade path
  for tail sampling/fan-out). **Receiver: upstat's OTLP ingest gateway**
  (OBS-001; gRPC 4317 + HTTP 4318, `Upstat-Ingest-Key` via
  OTEL_EXPORTER_OTLP_HEADERS) — sibling products are its first-party
  customers. **Sibling exporters default to OTLP/HTTP (4318)** — apparule
  and expendit remain 100% HTTP in practice; only upstat hosts gRPC (X-8). Until OBS-001 ships, services instrument NOW with export
  env-gated (unset OTEL_EXPORTER_OTLP_ENDPOINT = no-op). Logs dual-emit:
  JSON stdout stays (Cloud Run native logging) + OTLP to upstat. Operational
  telemetry (X-9) is SEPARATE from product analytics events (upstat
  /v1/events counters) — never mix the pipelines. Env names standard:
  OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
  OTEL_RESOURCE_ATTRIBUTES. ☑
- **X-10 Identity, profile & KYC tiers (RATIFIED, directive 2026-07-16)**: layered on
  X-1 — Google-only sign-in stays the sole credential; tiers add profile data and
  verification, never alternative logins. **Tier 0 — Google identity** (all
  products): firebase_uid + Google-verified email; grants all read/basic use.
  **Tier 1 — self-attested profile & location** (captured in product
  profile/settings; sensitive PII, never logged): apparule = bio + profile
  location {city, state, country} powering proximity-ranked designer
  recommendations ("near me") and delivery-address pre-fill (delivery address
  itself stays frozen per order); expendit = tax-jurisdiction location —
  state_of_residence for individuals, registered_address for company orgs —
  which resolves the remittance authority (State IRS vs FIRS); upstat = org
  timezone (IANA) only, for accurate report rendering and time-bucketing —
  deliberately the entire upstat requirement. **Tier 2 — provider-verified
  financial identity** (only where money moves or government filings
  generate; store provider refs + verification state, never raw government
  IDs): apparule designer payouts = Paystack bank resolution, BVN-backed
  (already ratified A-2 — canonized as the ecosystem pattern); expendit
  filing identity = TIN (+ RC number + registered address for companies)
  required at filing-pack generation (422 tax_identity_incomplete); v1
  verification is format validation + attestation, provider-verified arrives
  with direct e-filing (post-v1); upstat = N/A until billing enters the PRD.
  **Rules**: tiers gate capabilities, never sign-in; KYC state machines +
  error codes live in flow docs (apparule kyc_incomplete/post_unavailable is
  the template); tier-2 fields are high-sensitivity in every data-model §4
  classification; verification is delegated to the money/filing provider —
  no in-house document review. ☑
