# Upstat — API Surface

> Current surface verified against `internal/proto/*.proto` and the web app.
> The full gRPC reference lives in
> [api/common/docs/grpc-api.md](../api/common/docs/grpc-api.md) — this file
> maps it to the PRD and defines the target additions. Markers: **[Current]**,
> **[PRD]**, **[Proposed]**.

## 1. Current surface **[Current]**

### gRPC (api/common :8080, h2c; browsers via Envoy gRPC-Web :8082)

| Service | RPCs | Auth |
| --- | --- | --- |
| `UserService` | GetUser, GoogleAuth, CreateUser, UpdateUser, DeleteUser, GetAllUsers | CreateUser/GetUser/GoogleAuth public; rest JWT |
| `MonitorService` | CreateMonitor, UpdateMonitor, GetMonitor, ListMonitors, DeleteMonitor, GetStatusPage, GetRecentChecks | GetStatusPage + GetRecentChecks public; rest JWT (owner from token) |
| `InsightService` (served by api/observability :50051, consumed by api/common) | GetMonitorInsight | service-token |

### HTTP

| Endpoint | Notes |
| --- | --- |
| `GET /health`, `GET /ready` (both services) | probes |
| `GET /insights/{monitor_id}`, `POST /analyze/{monitor_id}` (observability :8081) | insight read/trigger |

## 1a. Service topology for new surfaces **[Decided]**

| Surface | Service | Port | Hostname | CORS/origin enforcement |
| --- | --- | --- | --- | --- |
| `/v1/events`, `/v1/stats`, `/v1/query`, `/v1/channels`, `/v1/monitors/*/rules` | **api/common** (Go — gains an HTTP mux alongside gRPC/h2c) | 8080 | `api.upstat.cuesoft.io` | in-app middleware (origin allowlist per property for /v1/events; standard CORS for user routes) |
| `upstat.js` static | web | 3000 | `upstat.cuesoft.io/upstat.js` | n/a (public asset) |
| OTLP gRPC/HTTP (OBS-001) | ingest gateway (new service at OBS-001) | 4317/4318 | `ingest.upstat.cuesoft.io` | key-authed, no browser CORS |
| Existing gRPC-Web | Envoy → api/common | 8082→8080 | as today | Envoy CORS (current) |

## 2. Target surface — monitors & alerts

> **Superseded by U-5 (HTTP-only for new surfaces):** the gRPC `AlertService`
> sketch below is retired — the alert surface is HTTP (`/v1/channels`,
> `/v1/monitors/{id}/rules`, openapi.yaml), same semantics. Kept for audit.

| Service / RPC | Purpose |
| --- | --- |
| ~~`AlertService.*` (gRPC)~~ | → HTTP per U-5; see flows/alert.md + openapi.yaml |

## 3. Target surface — events & stats (M2/M3, the ecosystem "D2" contract) **[Proposed]**

Plain HTTP/JSON — browser beacons can't speak gRPC and sibling servers
shouldn't need proto toolchains for two counters.

### 3.1 Ingestion

```
POST /v1/events
Authorization: Bearer <property_public_key>     (write-only key)
Origin: enforced against the property allowlist  (browser calls)

{
  "events": [
    {
      "name": "page_view" | "demo_start" | "github_click"
              | "upload_success" | "report_generation" | <registered name>,
      "ts": "2026-07-15T12:00:00Z",          // optional, server default now()
      "dims": {                               // closed vocabulary, all optional
        "path": "/pricing",
        "referrer_host": "google.com",
        "device_class": "mobile" | "desktop" | "tablet",
        "country": "NG"
      }
    }
  ]
}
→ 202 {accepted: n, rejected: m}
```

Rules: batch ≤ 100. **Mixed-batch semantics [Decided]:** the endpoint returns
`202 {accepted: n, rejected: m, rejections: [{index, code}]}` — per-item
rejection codes (`unknown_event`, `unknown_dim`, `ts_out_of_range`,
`bad_shape`) so sibling consumers can debug; whole-request 4xx is reserved
for auth (`401`), origin (`403 origin_not_allowed`), rate (`429`), and
malformed JSON (`400`). Unknown dims reject the item (privacy by schema);
per-key rate limits; `visitor_hash` computed server-side (cookieless,
browser events only — see §3.4a).

### 3.2 The tracking script (UPS-003 install surface)

```html
<script defer src="https://upstat.cuesoft.io/upstat.js"
        data-property="pk_live_…"></script>
<script>upstat("event", "demo_start")</script>
```

Auto page-views (incl. SPA history changes) + manual custom events.

### 3.3 Stats query (dashboards + sibling products' own metric reads)

```
GET /v1/stats?property=…&name=page_view&period=hour|day&from=RFC3339&to=RFC3339&dim=path
Authorization: Firebase bearer (owner) — not the public key
→ 200 {
    series: [{bucket: RFC3339, count, uniques}],
    totals: {count, uniques_daily_avg},
    uniques_additive: false,
    by_dim?: [{value, count}]        // when &dim= given; top 50 by count
  }
```

Contract: max range 92 days (`422 range_too_large`); one `dim` per query
(multi-dim = multiple queries); `period=hour` limited to ≤ 8-day ranges;
no pagination (bounded by range); errors: `404 not_found` (property not
owned), `422 invalid_period | range_too_large | ts_out_of_range`.

### 3.4 Consumer registry (who sends what)

| Consumer | Events (registered names) | Constraint |
| --- | --- | --- |
| apparule web (landing) | `page_view`, `demo_start`, `github_click`, `try_cloud_click`, `self_host_click` | counters only |
| apparule api | `auth_signin_completed`, `auth_signin_failed`, `vault_capture_started`, `vault_qc_failed{code}`, `vault_session_saved{method}`, `vault_manual_entry`, `request_started`, `request_submitted`, `request_paid`, `request_delivered`, `request_disputed{reason}`, `consent_recorded{document}` | counters + listed dims only — never measurement values or amounts |
| expendit web (landing) | `page_view`, `try_cloud_click`, `self_host_click`, `github_click`, `demo_interact` | counters only |
| expendit api | `auth_signin_completed`, `auth_migration_completed`, `auth_migration_stranded`, `upload_success{file_type}`, `import_confirmed`, `import_discarded`, `report_generation{kind}`, `bank_link_created`, `bank_sync_completed`, `bank_reauth_required`, `consent_recorded{document}` | counters + `file_type`/`kind` dims only — never amounts/descriptions/institutions |
| upstat itself | `page_view` on upstat.cuesoft.io, `try_cloud_click`, `self_host_click`, `github_click` (landing CTAs — registered 2026-07-18 ahead of W2 instrumentation, per §3.4a registry-first), `auth_signin_completed`, `auth_migration_completed`, `monitor_created`, `monitor_state_changed{to}` | dogfooding (§5 reliability showcase); landing events counters only |

### 3.4a Registry-as-schema **[Decided — closes the dims contradiction]**

The registry table IS the ingest schema: the §3.1 "closed vocabulary" =
`page_view`'s browser dims (`path`, `referrer_host`, `device_class`,
`country`) **plus, per registered event, exactly the dim keys named in its
registry row** (e.g. `vault_qc_failed{code}` admits `code` with the
capture-qc enum; `upload_success{file_type}` admits `file_type`). The ingest
validator resolves the event name against the registry and rejects any dim
not registered for that event (`unknown_dim`). Value enums live with the
registry row's source doc.

**Uniques eligibility:** server-emitted events (sibling `api` rows) carry the
*server's* IP/UA — they are `unique_ineligible: true` in the registry and
excluded from uniques math (analytics-math.md §4a); only browser events count
visitors.

Pending registration (added now): apparule `request_quoted`,
`request_declined{reason}`, `payout_released` (flows/designer.md);
expendit `statement_confirmed{kind}` (flows/statement-mapping.md).
`auth_migration_stranded` is REMOVED from the registry (it is a support-ticket
tag, not an ingest event).

This table is the **master event registry** for the ecosystem — sibling repos'
instrumentation sections reference it; adding an event means updating this
table first (same PR discipline as error codes, engineering.md §1).
New event names are registered per property (no free-form names) — keeps the
schema-as-privacy-boundary enforceable.

## 4. Gap analysis — requirement → current → needed

| Requirement | Current | Gap |
| --- | --- | --- |
| UPS-001 landing | `/` exists; Figma design available | apply design + demo cards (web only) |
| UPS-002 app entry | auth + dashboard work | CTAs; D1 later |
| UPS-003 setup docs | self-host docs only | user guides for monitors/script/alerts/retention — after those features exist |
| UPS-004 example cards | components exist | landing embed with demo data |
| UPS-005 privacy | nothing | privacy page + D3 clause |
| MON-001 alerts | status flips silently | AlertService + worker dispatch + channels |
| ANA-001 ingestion + script | nothing | §3.1–3.2 |
| ANA-002 real dashboards | mock routes | `/v1/stats` + traffic page rewire |
| ECO-TRACK (D2) | nothing | §3 shipped = apparule/expendit unblocked |

## 5. Conventions

Shared ecosystem conventions (error envelope, pagination, idempotency) apply
to the new HTTP surfaces exactly as written in apparule's api.md §4; gRPC
error semantics stay as documented in grpc-api.md. **[Proposed]**

---

## 6. Observability platform surface (2026-07-16) **[Proposed]** — deltas

| Group | Surface |
| --- | --- |
| Ingestion | OTLP/gRPC + OTLP/HTTP (`/v1/otlp/{traces,metrics,logs}`), authn `Upstat-Ingest-Key`; StatsD UDP/TCP shim; existing `/v1/events` + vitals payloads (RUM SDK) |
| Query | `POST /v1/query` (shared grammar → timeseries/log/trace results; powers explorers, dashboards, monitor evaluator) |
| Dashboards | CRUD + portable JSON import/export |
| Monitors | rule CRUD (signal-generic), `POST /v1/monitors/{id}/test` (24h replay), triggered-feed |
| Incidents | declare/update/resolve, timeline entries, postmortem attach |
| SLOs | CRUD + status/burn endpoints |
| Service catalog | CRUD + telemetry-presence summary |
| Keys | ingest-key CRUD with scopes/quotas |

gRPC remains for the existing user/monitor control plane; all new surfaces
are HTTP/JSON (ecosystem conventions). RUM/browser SDK (`upstat.js`) extends
the Phase-1 script with web-vitals + error capture — same property keys.
