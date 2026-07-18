# Upstat — Engineering Contracts

> Error catalog, authorization matrix, rate limits, testing strategy, logging
> rules. Ecosystem envelope (inlined, normative):
> `{"error": {"code": "snake_case_stable", "message": "human copy", "details": {}}}` —
> codes stable, cross-tenant access always `not_found`;
> gRPC surfaces map the same codes onto status codes
> (`INVALID_ARGUMENT`/`UNAUTHENTICATED`/`PERMISSION_DENIED`/`NOT_FOUND`/
> `ALREADY_EXISTS`/`RESOURCE_EXHAUSTED`/`FAILED_PRECONDITION`).

## 1. Error catalog (product families)

Flow-spec-owned codes: monitors (flows/monitor.md — `name_taken`,
`timeout_gte_interval`), alerts (flows/alert.md — `channel_unverified`,
`verification_expired`), events (analytics-math.md — `ts_out_of_range`,
schema/origin rejections with per-reason counters), auth (flows/auth.md —
`provider_not_allowed`, `migrate_to_firebase`), query
(`invalid_query{position, hint}` — query-grammar.md §3's error-not-empty
rule), ingest (`quota_exceeded`, `key_scope_mismatch` — OBS-001).

## 2. Authorization matrix

Current model: single-owner resources; org roles arrive with the OBS
build-out (data-model.md §5 ORG). Matrix for the org era, applied to the
owner-only model as "owner=everything, others=nothing" until then:

| Resource / action | viewer | member | admin | owner |
| --- | --- | --- | --- | --- |
| Dashboards/explorers read | ✓ | ✓ | ✓ | ✓ |
| Monitors create/edit/pause | — | ✓ | ✓ | ✓ |
| Alert channels create/verify | — | ✓ | ✓ | ✓ |
| Channel delete; rules bulk ops | — | — | ✓ | ✓ |
| Properties + ingest keys | — | — | ✓ | ✓ |
| Key rotation/revocation | — | — | ✓ | ✓ |
| Incidents declare/update | — | ✓ | ✓ | ✓ |
| SLOs define | — | — | ✓ | ✓ |
| Org members, retention settings | — | — | — | ✓ |
| Public status pages (read) | ✓ (world) | ✓ | ✓ | ✓ |
| Status-page config | — | — | ✓ | ✓ |

Role source **[Decided]**: org roles live in the control-plane DB (not
Firebase custom claims) — resolved per request alongside org context.

Machine identities: `SERVICE_TOKEN` (observability↔common, fixed scope);
property public keys (write-only ingest, U-2) — neither ever grants user-API
access.

## 3. Rate limits

| Surface | Limit |
| --- | --- |
| Events ingest | 600/min sustained, 1200 burst per property key (analytics-math.md §6) |
| Stats/query API | 60/min per user |
| Monitor CRUD | 60/min per user |
| Monitor test-replay (MI-9) | 6/min per user |
| Channel verification sends | 5/hr per channel |
| OTLP ingest (OBS-001) | per-key quotas, defaults: 10k metric points/s, 5k log lines/s, 1k spans/s **[Decided defaults]** |
| `/v1/events` pre-auth | 1,000 req/min per IP (invalid-key flood guard) |
| Insights `GET /insights/*`, `POST /analyze/*` | **bearer-authed (REVISED — was open)**; analyze 6/min per user (LLM cost guard) |

Limit store: **shared Aiven Redis** (X-5 — this is Redis's role here, plus
dispatch cooldown cache); `429 rate_limited` + `Retry-After` (cataloged §1).

## 4. Testing strategy

| Layer | Scope | Non-negotiables |
| --- | --- | --- |
| Unit (Go/pytest) | worker, dispatcher, rollups, hash | **evaluation-semantics transition table** (flows/monitor.md §2 — every edge incl. `nodata`); dispatch ordering + cooldown fixtures (flows/alert.md §3); visitor-hash rotation vectors; rollup idempotency (analytics-math.md §7) |
| Contract | error catalog + query grammar | grammar: valid/invalid corpus with position-accurate errors; `uniques_additive:false` metadata presence |
| Integration (compose) | web → envoy → gRPC; events → rollup → stats | webhook signature fixture (documented recipe verifies) |
| E2E smoke (release tag) | signin → create monitor → down-simulation → alert → recover | against sandbox in release.yml; uses a controllable target service |
| Privacy invariants | events pipeline | raw IP/UA absent from storage + logs (grep + storage-scan test) |

Web implementation (MVC boundaries, TEST_MODE, mock server, Vitest/Playwright
layers, legacy policy) follows [web-implementation.md](web-implementation.md).

## 5. Logging & observability (dogfooding rule)

Ecosystem conventions (request-id line, ids not emails). **Never-log list**
(CI grep-gated): raw visitor IP/UA, channel secrets & webhook URLs' auth
components, service tokens, ingest keys, monitor target credentials (if URL
userinfo is ever supported: reject instead). Upstat monitors Upstat: its own
services run the tracking script + uptime checks + (later) OTLP — every new
pillar's first customer is this repo, and the public status page (Phase 0)
is the standing proof.

## 6. Acceptance

- [ ] Transition-table test covers every state edge incl. worker-outage `nodata`
- [ ] Grammar corpus: 30+ valid / 30+ invalid queries with exact error positions
- [ ] Rollup re-run produces byte-identical settled buckets
- [ ] Storage-scan test proves no raw IP/UA at rest
- [ ] Release smoke drives a real down→alert→recover cycle in sandbox

## CORS contract (ecosystem standard)

- Env: **`CORS_ORIGINS`** — comma-separated exact origins; no wildcard in
  cloud; `http://localhost:3000` default for native dev.
- Behaviour: echo the request Origin **only if allowlisted**; `Vary: Origin`;
  `Allow-Credentials: false` (bearer auth — no cookies);
  methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`; headers
  `Authorization, Content-Type, Idempotency-Key, X-Org-Id`; preflight 204
  with `Access-Control-Max-Age: 600`.
- App-level CORS applies to the HTTP surfaces (api.md §1a) from U1-2; browser gRPC-Web CORS stays in Envoy config.

## Telemetry (OpenTelemetry, X-9)

- Traces: OTel SDK auto-instrumentation (HTTP server/client, gRPC, DB) +
  manual spans on domain operations; W3C traceparent propagated on every
  outbound call (incl. service-to-service).
- Metrics: OTel Meter API — each service registers its KPI instruments
  (request histograms come free; domain counters per the flow specs'
  instrumentation sections are PRODUCT events via upstat /v1/events, NOT
  OTel metrics — keep the pipelines separate).
- Logs: slog/logging → OTel bridge dual-emit (JSON stdout for Cloud Run +
  OTLP to upstat). The never-log list applies to BOTH pipelines.
- Export: direct OTLP, env-gated (no endpoint ⇒ no-op); receiver = upstat
  ingest (X-9). Sampling: parent-based, 10% default, errors always.
