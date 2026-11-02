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
the control plane migrates Mongo→**managed Postgres**; "Mongo stays" in the
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
immediately), **email via Resend** second (developer-grade DX;
SES is the escape hatch later); Slack via webhook URL
initially, native app later.

☑ Ratified — **email provider REVISED by X-7 (2026-07-16): Brevo REST API** (was Resend); webhooks-first unchanged

## U-5 · Protocol split — gates all new surfaces

**Recommendation ⭐:** existing user/monitor control plane stays **gRPC**
(works, typed); every new surface is **HTTP/JSON**
(events, stats, query, OTLP/HTTP alongside OTLP/gRPC, dashboards, monitors-v2,
incidents, SLOs). Browsers and sibling products never need proto toolchains.

☑ Ratified

> **Superseded 2026-10-28:** product gRPC, gRPC-Web and Envoy removed; service traffic is HTTP; OTLP ingest keeps gRPC 4317 alongside HTTP 4318.

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
parity canon; the link inventory is unchanged, pages.md A1) · **§5**
colorblind mode (`upstat.colorvision`, theme-contract persistence;
design.md §5) · **§5** chart data-table toggle (design.md §5) · **B4**
virtualized log stream (bespoke spacer windowing; pages.md B4) · **B9**
postmortem template on resolve (pages.md B9) · **B8** monitors
grouped-by-state view (literal-reading **[Decided 2026-07-20]** line in
pages.md B8). As-built detail: web-implementation.md "Wave A as-built"
blocks.

☑ Ratified

## Cross-cutting (shared with sibling products)

- **X-1 account.cuesoft.io / identity (RATIFIED)**: interim + sandbox identity
  is **Google sign-in run by each product's API**: the API completes the
  Google OAuth code flow (redirect, handoff exchange) and issues its own
  session JWT in an HttpOnly session cookie, which services verify.
  `account.cuesoft.io` **is not built yet**, so each app replicates the
  sign-in/sign-up screens **in-app** (own UI per its design system,
  Google sign-in underneath). The central facade fronts the same Google
  identity later without contract changes; in-app screens then become
  optional, not obsolete. **HARDENED 2026-07-16: Google sign-in is the ONLY
  method, no username/password signup or login, product-wide.** The API
  exposes no other sign-in route and rejects unverified Google emails; UI
  ships exactly one auth CTA. **AMENDED 2026-10-28: the API owns Google
  sign-in**; Firebase Authentication is not in the sign-in path. Full
  contract: [flows/auth.md](flows/auth.md). Environment/secrets live in
  **your secrets manager** (the product's `stg` config); variable names are
  documented in `.env.example`. Valkey user `upstat` (keys `upstat:*`) is
  provisioned by your infrastructure-as-code. ☑
- **X-2 Docs platform**: GitBook space per product, Git-synced; Scalar API
  refs. **RATIFIED 2026-07-20**: every product ships a public `/docs/api`
  route embedding the Scalar interactive reference, rendered live from the
  repo's `docs/api/openapi.yaml` (served at `/docs/api/openapi.yaml`); the
  footer Docs column's "API reference" links it (was the GitBook
  api-surface page). ☑
- **X-3 Cloud deployment target (RATIFIED)**: all backend
  services run on **Google Cloud Run** (per-service containers — the same
  `cuesoft/<repo>-<service>` images), provisioned by your infrastructure-as-code stack; frontends deploy to **Firebase App
  Hosting**. Helm + terraform in `deploy/` remain the **self-host** path —
  cloud and self-host share images, not manifests. ☑
- **X-4 AI platform (RATIFIED 2026-07-16)**: AI features use
  **Vertex AI** (Gemini via `{region}-aiplatform.googleapis.com`, ADC from the
  calling service's own service account;
  reference model `gemini-2.5-flash-lite`, region `us-central1`). No
  consumer-API keys to third-party AI vendors in cloud deployments — data
  stays inside GCP, which strengthens every privacy disclosure. Self-host
  fallback: bring-your-own Gemini/Groq key via env (existing code path). ☑
- **X-5 Data plane (RATIFIED 2026-07-16, per-product DB decided by delegation)**:
  **managed Postgres** for the control plane (users, monitors, dashboards,
  rules, incidents, SLOs) — migrating from Mongo with the monitors-v2/OBS
  work; **ClickHouse** remains the telemetry store (U-1 unchanged).
  **Shared Valkey**: the sandbox **managed Valkey** instance,
  tenancy by a per-product user (`upstat`) limited to `upstat:*` keys;
  credentials in your secrets manager. **your secrets manager is the env
  source of truth**: project `upstat` with `dev / dev_personal / stg / prd`
  configs (already created). **Object storage**: the **default Cloud Storage bucket** in
  `<project-id>` (per-product prefixes `upstat/<env>/…`) for capture
  media, exports, and artifacts. Self-host compose keeps its bundled
  stores. ☑
- **X-6 Environments & deploy gating (RATIFIED 2026-07-16, deliberate
  deviation from the norm)**: `stg` = **sandbox** and is the ONLY
  environment — no production deployment exists for these products. Secrets
  live in your secrets manager (`stg` config). Because these repos are **open-source**,
  merge-to-main must NOT deploy: main-merge runs build+test only. **Deploys
  happen exclusively on tag creation (`v*`)**, treated as production-grade:
  a GitHub tag ruleset restricts `v*` creation to owner-level access, and the
  deploy workflow additionally runs in a protected GitHub environment. ☑
  **Revised 2026-10-27:** "Deploy on merge to main". A merge to
  `main` that touches `api/**` deploys the API services to the sandbox; no
  `v*` tags, since the open-source products cut no releases yet.
- **X-7 Transactional email (RATIFIED 2026-07-16)**: **Brevo REST
  API** for all product email (alert emails, money-event receipts, purge
  confirmations…) with `BREVO_API_KEY`, `BREVO_FROM_EMAIL`,
  `BREVO_FROM_NAME` in your secrets manager. **No SMTP anywhere**, existing SMTP/gomail
  plumbing retires when next touched. Revises U-4's Resend pick where it
  applied. ☑
- **X-8 Protocol standard (RATIFIED 2026-07-16)**: ecosystem APIs are
  **HTTP/JSON**. gRPC exists ONLY where upstat needs it: **OTLP/gRPC ingest**
  (OTel industry standard, OBS-001), internal s2s (observability↔common),
  and the existing monitor control plane until monitors-v2. Cloud Run runs
  gRPC fine with end-to-end HTTP/2 (h2c) — already how api/common works.
  **Browser gRPC-Web is a sunset path**: no new surface uses it
  (U-5); at monitors-v2 (OBS-006) the dashboard goes fully HTTP. Envoy is
  not deployed to the cloud. sibling products never adopt gRPC. ☑
  > **Superseded 2026-10-28:** product gRPC, gRPC-Web and Envoy removed; service traffic is HTTP; OTLP ingest keeps gRPC 4317 alongside HTTP 4318.
- **X-9 Telemetry standard (RATIFIED 2026-07-16)**: **OpenTelemetry
  everywhere** — traces, custom metrics, and logs from every service via OTel
  SDKs (Go: otel-go + slog bridge; Python: opentelemetry-python + logging
  handler; Next: @opentelemetry/sdk-node), W3C `traceparent` propagation
  across HTTP and gRPC. **Export: direct OTLP from the SDK in v1** (batch
  processors; collector sidecar on Cloud Run is the documented upgrade path
  for tail sampling/fan-out). **Receiver: upstat's OTLP ingest gateway**
  (OBS-001; gRPC 4317 + HTTP 4318, `Upstat-Ingest-Key` via
  OTEL_EXPORTER_OTLP_HEADERS) — sibling products are its first-party
  customers. **Sibling exporters default to OTLP/HTTP (4318)**, and
  they remain 100% HTTP in practice. Until OBS-001 ships, services instrument NOW with export
  env-gated (unset OTEL_EXPORTER_OTLP_ENDPOINT = no-op). Logs dual-emit:
  JSON stdout stays (Cloud Run native logging) + OTLP to upstat. Operational
  telemetry (X-9) is SEPARATE from product analytics events (upstat
  /v1/events counters) — never mix the pipelines. Env names standard:
  OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
  OTEL_RESOURCE_ATTRIBUTES. ☑
- **X-10 Identity, profile & KYC tiers (RATIFIED 2026-07-16)**: layered on
  X-1 — Google-only sign-in stays the sole credential; tiers add profile data and
  verification, never alternative logins. **Tier 0 — Google identity** (all
  products): Google-verified email; grants all read/basic use.
  **Tier 1, self-attested profile & location** (captured in product
  profile/settings; sensitive PII, never logged): sibling measurements product = bio + profile
  location {city, state, country} powering proximity-ranked designer
  recommendations ("near me") and delivery-address pre-fill (delivery address
  itself stays frozen per order); sibling expenses product = tax-jurisdiction location
  (state_of_residence for individuals, registered_address for company orgs),
  which resolves the remittance authority (State IRS vs FIRS); upstat = org
  timezone (IANA) only, for accurate report rendering and time-bucketing —
  deliberately the entire upstat requirement. **Tier 2, provider-verified
  financial identity** (only where money moves or government filings
  generate; store provider refs + verification state, never raw government
  IDs): sibling designer payouts = Paystack bank resolution, BVN-backed
  (already ratified A-2, canonized as the ecosystem pattern); sibling expenses
  product filing identity = TIN (+ RC number + registered address for companies)
  required at filing-pack generation (422 tax_identity_incomplete); v1
  verification is format validation + attestation, provider-verified arrives
  with direct e-filing (post-v1); upstat = N/A until billing enters the PRD.
  **Rules**: tiers gate capabilities, never sign-in; KYC state machines +
  error codes live in flow docs (a sibling's kyc_incomplete/post_unavailable is
  the template); tier-2 fields are high-sensitivity in every data-model §4
  classification; verification is delegated to the money/filing provider —
  no in-house document review. ☑
- **X-11 Shared message bus (RATIFIED, boss 2026-10-13)**: the sibling
  products and upstat share **one managed Kafka service** under the CueLABS delivery
  standard's `references/shared-messaging.md` (the contract; read it before
  designing any Kafka use). Three topics ("lanes") serve every product:
  `cuelabs.uploads` (gateway → control plane), `cuelabs.requests` (control
  plane → processing), `cuelabs.results` (processing → control plane); two
  more are held in reserve and need a decision. Event types are
  `<product>.<domain>.<event>`; consumers read the type first and skip what
  isn't theirs. **Payloads go by pointer** (claim-check in the product's own
  storage prefix) because every product can read the lanes. No compacted
  topics: config travels in requests or as a snapshot object. Retention is
  the service's fixed setting, so nothing may depend on the bus keeping a
  message for more than a day; each control plane re-sends overdue work
  from its own store. One Kafka user per product (one per sibling product, plus
  `upstat`); consumer groups `<product>-<service>`. The service powers off
  after 24 h with no traffic and drops its messages: **keep-alive owner is
  the sibling expenses product** (its `api/common` reaper sends a heartbeat every 6 h and powers
  the service back on through the managed-service API); the other products run no
  heartbeat or watchdog. Bulk data never rides the bus (upstat telemetry
  goes through the OpenTelemetry Collector instead). ☑

## System design (S-1 … S-13)

> **Decided 2026-10-29, built the same day, pending the boss's review.**
> The product owner took the open S-1…S-12 calls on the boss's standing
> delegation ("decide as you think best; the boss checks afterwards"); each
> row records what was decided and what changed from the v2.1 draft of
> [system-design.md](system-design.md). Rows marked ⚠ carry a cost or
> provisioning step for the boss.

| ID | Decision | Status |
| --- | --- | --- |
| **S-1** | Units: `web` · `api/common` (Go, CRUD) · `api/query` (Go, ClickHouse reads) · **`api/observability` (Node/NestJS, the ingest gateway)** · **`api/analytics` (Python: evaluator, notifier, rule and SLO evaluation, insights)** · `functions/probe` (Python) · the stock OTel Collector. Changed from the draft: the gateway keeps the manifest's `observability` name, and alerting and insights are one Python service, `analytics`, with insights run in the background so an ML or Vertex stall never delays an alert. | ☑ |
| **S-2** | The shared Kafka bus (X-11) carries control events only: `config.changed`, `synthetics.result`, `alerting.verify_requested` on `cuelabs.requests`; `monitor.transition`, `alerting.delivery`, `rule.evaluated`, `slo.evaluated`, `insights.generated` on `cuelabs.results`. Synchronous calls: `common → probe`, `common → query` (status bars, history, replay), `analytics → query`. | ☑ |
| **S-3** | Check results, events, rollups and usage live only in ClickHouse. | ☑ |
| **S-4** | ClickHouse stays the telemetry store: the code, the schema (`api/common/migrations/clickhouse`) and compose use the open-source server. ⚠ **Cloud hosting is the boss's call**: ClickHouse Cloud is paid, as is Aiven's ClickHouse; the alternative is a self-run ClickHouse on a small GCE VM. Only `CLICKHOUSE_URL` and credentials change. | ☑ ⚠ |
| **S-5** | Multi-region probing, quorum `min_failing_regions` 2 of 2, regions `us-central1` and `us-east4`. ⚠ Two Cloud Run functions to provision (release.yml deploys their source). | ☑ ⚠ |
| **S-6** | Telemetry loading is stock: the gateway forwards OTLP unparsed to the OTel Collector (`deploy/docker/otel-collector.yaml`), which stamps the org from `X-Upstat-Org-Id` and writes ClickHouse (`create_schema: false`). Changed by X-11: no Kafka hop and no ClickHouse Kafka engine; product events, check results and usage reach ClickHouse as OTLP logs that materialized views split out. | ☑ |
| **S-7** | All service traffic is HTTP; gRPC only for OTLP ingest. | ☑ |
| **S-8** | Config propagation by transactional outbox → **snapshot objects** (`<prefix>/config/<kind>.json`, rewritten by the publisher) + `upstat.config.changed`. Changed by X-11: no compacted topics. | ☑ |
| **S-9** | Tenancy in depth: Postgres row-level security (FORCE, non-superuser app role) and ClickHouse row policies on `SQL_upstat_org`, plus the predicate `api/query` always injects. | ☑ |
| **S-10** | Consumers run as scale-to-zero Cloud Run services ~~with CPU always allocated~~ (request-based CPU since S-14), woken by `GET /health` (`WAKE_<TARGET>_URL`). `api/query` shares `api/common/pkg` via `replace ../common`. New env names: `CLICKHOUSE_URL`, `PROBE_URLS`, `QUERY_URL`, `OTLP_LOADER_ENDPOINT`, `INTERNAL_TOKEN`, `INTERNAL_AUDIENCE`, `INTERNAL_INVOKERS`. | ☑ |
| **S-11** | Ingest quotas in bytes per second per key (default 2 MB/s, `INGEST_BYTES_PER_SECOND`); the usage report meters accepted bytes for metrics, logs and traces and events for RUM, because the gateway never parses OTLP. `api/query` uses no Valkey. | ☑ |
| **S-12** | Probe source in `functions/probe/` (Python, functions-framework, pycurl), a container for self-host. | ☑ |
| **S-13** | Added while building: SLIs are `check` (passing ÷ completed checks of the SLO's monitor), `latency` (share of the query's spans at or under 500 ms) and `metric_ratio` (`<good query> / <total query>`); `slo_burn` rules name an SLO in their query string. Uptime rules select monitors with `check:<name or id>` and events with `on:down|recovered|nodata|all` (default down and recovered). Browser synthetic checks are stored and listed but report one failed step until the probe ships a headless browser. Weekly RUM retention reports no cohorts: the daily salt makes cross-day visitors impossible by design (U-3). | ☑ |
| **S-14** | Added 2026-11-02, matching the sibling expenses product (every service at min 0 with **request-based CPU**, so idle costs nothing): no Upstat unit runs CPU always allocated, including the collector. Because an instance only has CPU inside a request, work that must finish is done inside one: a write publishes its outbox rows before it answers; each run-checks pass ends with `POST /internal/settle` on analytics (evaluate, the hourly insight pass when due, then answer once its lanes are caught up) and then waits until common has handled the transitions it got back. query and the gateway reread their snapshots when a lookup misses (floors 10 s and 30 s). The collector exports before it answers (no batch processor, no sending queue; ClickHouse async inserts batch), so the outage buffer is the sender's OTLP retry. Scheduler jobs drop to `upstat-run-checks` and `upstat-prune`. Amends S-10. | ☑ |
