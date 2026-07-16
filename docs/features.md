# Upstat — Granular Feature Register

> Roadmap phases decomposed into implementation-sized units (each ≈ one PR).
> IDs stable for PR references (`feat(U1-3): …`).

## Phase 0 — Landing + privacy

| ID | Unit | Delivers | Refs | Deps |
| --- | --- | --- | --- | --- |
| U0-1 | Design tokens package | `upstat/tokens` (#00E09E) → CSS vars/Tailwind; dark-first | design.md §2/§7 | — |
| U0-2 | Landing build | apply Figma design: hero, pillar grid, ingestion diagram, cloud-vs-oss | pages.md A1–A10 | U0-1 |
| U0-3 | Demo cards | example uptime/analytics cards w/ synthetic data | pages.md A4, UPS-004 | U0-2 |
| U0-4 | Privacy page | cookieless model disclosure per analytics-math §1 | UPS-005 | U0-2 |
| U0-5 | Self status page | configure GetStatusPage for upstat itself, link from landing | prd §5 showcase | — |

## Phase 1 — Events layer (D2: unblocks siblings)

| ID | Unit | Delivers | Refs | Deps |
| --- | --- | --- | --- | --- |
| U1-0 | Postgres control-plane provisioning | Aiven PG (X-5) schema for events/rollups/properties | data-model, X-5 | — |
| U1-1 | Property + key model | PROPERTY rows, write-only keys (24h rotation grace), origin allowlists | data-model §2, U-2 | U1-0 |
| U1-2 | Ingest endpoint | POST /v1/events: schema/origin/ts/rate validation, rejection counters | api.md §3.1, analytics-math §5–6 | U1-1 |
| U1-3 | visitor_hash | daily salt rotation, hash pipeline, no-raw-IP storage test | analytics-math §1 | U1-2 |
| U1-4 | upstat.js | cookieless script: auto page_view (SPA-aware), custom events, batching | api.md §3.2 | U1-2 |
| U1-5 | Rollup worker | hourly/daily buckets, sessionization (VISIT_ROLLUP), exact uniques, 48h self-heal | analytics-math §2–3 | U1-2, U1-3 |
| U1-6 | Stats API | GET /v1/stats + uniques_additive metadata | api.md §3.3, analytics-math §4 | U1-5 |
| U1-7 | Property settings UI | keys, origins, rejection counters | pages.md B12 | U1-1 |
| U1-8 | Sibling onboarding | register apparule/expendit events per master registry | api.md §3.4 | U1-2 |

## Phase 2 — Honest dashboards + alerting

| ID | Unit | Delivers | Refs | Deps |
| --- | --- | --- | --- | --- |
| U2-1 | Traffic pillar on real data | /v1/stats wiring, mock routes deleted | ANA-002, pages.md B6 | U1-6 |
| U2-2 | `nodata` + flapping semantics | worker state machine per contract + transition tests | flows/monitor §2 | — |
| U2-3 | Alert channels | webhook (signed) + email (Resend) + verification flows | flows/alert §1, U-4 | — |
| U2-4 | Alert rules + dispatcher | rules CRUD, dispatch ordering/cooldown/retries, flapping guard | flows/alert §2–3 | U2-2, U2-3 |
| U2-5 | Alert UX | channels/rules UI, triggered feed MI-14, bulk opt-in sheet | pages.md B8 | U2-4 |
| U2-6 | Setup docs (UPS-003) | monitor/script/alert/retention user guides → GitBook | flows/*, analytics-math | U1-4, U2-4 |
| U2-7 | Control-plane Postgres migration | Mongo→PG per X-5, parity harness | X-5, engineering §4 | — |

## Phases 3–7 — Observability pillars (each gated on U-1 ClickHouse)

| ID | Unit | Delivers | Refs |
| --- | --- | --- | --- |
| U3-1 | ClickHouse provisioning | compose service + cloud instance + schemas | architecture expansion, U-1 |
| U3-2 | Ingest gateway | OTLP gRPC+HTTP, ingest keys/scopes/quotas | api.md §6, data-model §5 |
| U3-3 | Query service | shared grammar AST → per-store compilation | query-grammar.md |
| U3-4 | Metrics explorer | QueryBar + TimeseriesPanel + MI-1/2/3 | pages.md B3, design.md |
| U3-5 | Dashboard grid v1 | widgets, editing MI-11/12, portable JSON | pages.md B2 |
| U3-6 | Metric monitors | thresholds on query results via generalized evaluator | pages.md B8 |
| U4-1 | Log intake | OTLP logs → ClickHouse `logs` table, org quotas | data-model DDL | U3-1, U3-2 |
| U4-2 | Logs explorer | FacetSidebar + QueryBar + virtualized LogLine + histogram + live tail (MI-4/5/6) | pages.md B4, query-grammar | U4-1, U3-3 |
| U4-3 | Log monitors | count/pattern rules via the generalized evaluator | flows/alert, U3-6 | U4-2 |
| U5-1 | Trace intake | OTLP traces → `spans` table | data-model DDL | U3-1, U3-2 |
| U5-2 | Service list + pages | req/s, p50/95/99, error rate per service; endpoints table | pages.md B5 | U5-1, U3-3 |
| U5-3 | Trace explorer + waterfall | search → TraceWaterfall (MI-7) + span drawer | pages.md B5 | U5-2 |
| U5-4 | Service map + catalog | force-layout map; SERVICE_ENTRY registry (OBS-010) | pages.md B5/B11 | U5-2 |
| U6-1 | RUM SDK v2 | upstat.js gains web vitals (LCP/CLS/INP) + JS error capture (fingerprint grouping) | pages.md B6 | U1-4 |
| U6-2 | RUM pages complete | vitals dashboards, error tracking UI; bounce/SEO pages resolve honestly | pages.md B6, ANA-002 | U6-1 |
| U7-1 | Incidents v2 | sev/roles/timeline composer (MI-10), postmortem template on resolve | pages.md B9, data-model §5 | U2-4 |
| U7-2 | SLOs | SLI sources (check/metric ratio/latency), 30d rolling windows, SLOCards (MI-15) | pages.md B10 | U3-4 |
| U7-3 | Burn-rate monitors | fast/slow burn rules (2h @ 14.4x, 24h @ 6x — Google SRE defaults) | U7-2, U3-6 | U7-2 |

Acceptance per pillar = its pages.md section + the engineering.md privacy/
retention gates; every pillar ships explorer + retention + monitors together
(architecture honesty stance).

## Cross-phase engineering units

| ID | Unit | Refs |
| --- | --- | --- |
| UX-1 | Firebase Google-only auth (gRPC metadata + HTTP) + migration | flows/auth |
| UX-2 | Error envelope (HTTP) + gRPC status mapping | engineering §1 |
| UX-3 | Authz (owner-model now, org-ready matrix) | engineering §2 |
| UX-4 | Never-log gate + storage-scan privacy test | engineering §5 |
| UX-5 | build-and-test.yml + release.yml (tag-gated) | deployment.md, X-6 |
| UX-6 | cuesoft-iac upstat stack (Cloud Run ×3, WIF, Doppler, Aiven PG) | deployment.md §2 |
| UX-7 | E2E smoke: down→alert→recover cycle | engineering §4 |
