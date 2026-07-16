# Upstat — Engineering Contracts

> Error catalog, authorization matrix, rate limits, testing strategy, logging
> rules. Ecosystem envelope + conventions per apparule engineering.md §1;
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
| Public status pages | world-readable by design | | | config: admin+ |

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
| OTLP ingest (OBS-001) | per-key quotas (data-model.md `INGEST_KEY.quotas`) |

## 4. Testing strategy

| Layer | Scope | Non-negotiables |
| --- | --- | --- |
| Unit (Go/pytest) | worker, dispatcher, rollups, hash | **evaluation-semantics transition table** (flows/monitor.md §2 — every edge incl. `nodata`); dispatch ordering + cooldown fixtures (flows/alert.md §5); visitor-hash rotation vectors; rollup idempotency (analytics-math.md §7) |
| Contract | error catalog + query grammar | grammar: valid/invalid corpus with position-accurate errors; `uniques_additive:false` metadata presence |
| Integration (compose) | web → envoy → gRPC; events → rollup → stats | webhook signature fixture (documented recipe verifies) |
| E2E smoke (release tag) | signin → create monitor → down-simulation → alert → recover | against sandbox in release.yml; uses a controllable target service |
| Privacy invariants | events pipeline | raw IP/UA absent from storage + logs (grep + storage-scan test) |

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
