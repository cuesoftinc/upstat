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
| `web /api/dashboard/stats`, `/api/dashboard/total-users` | **mock data** — scaffolding to be replaced (ANA-002), not product surface |

## 2. Target surface — monitors & alerts **[Proposed]**

Monitors stay gRPC (working, typed, already browser-reachable via Envoy).
Additions:

| Service / RPC | Purpose |
| --- | --- |
| `AlertService.CreateChannel / ListChannels / VerifyChannel / DeleteChannel` | email/webhook channels (MON-001) |
| `AlertService.SetRules / GetRules` | per-monitor rules (on: down/recovered, cooldown) |

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

Rules: batch ≤ 100; unknown `dims` keys → event rejected (privacy by schema);
per-key rate limits; `visitor_hash` computed server-side (cookieless).

### 3.2 The tracking script (UPS-003 install surface)

```html
<script defer src="https://upstat.cuesoft.io/upstat.js"
        data-property="pk_live_…"></script>
<script>upstat("event", "demo_start")</script>
```

Auto page-views (incl. SPA history changes) + manual custom events.

### 3.3 Stats query (dashboards + sibling products' own metric reads)

```
GET /v1/stats?property=…&name=page_view&period=day&from=…&to=…&dim=path
Authorization: user JWT (owner) — not the public key
→ {series: [{bucket, count, uniques}], totals: {…}}
```

### 3.4 Consumer registry (who sends what)

| Consumer | Events | Constraint |
| --- | --- | --- |
| apparule web | `demo_start`, `github_click` | counters only |
| expendit api | `upload_success`, `report_generation` | counters + `file_type`/`kind` dim only — never amounts/descriptions |
| upstat itself | `page_view` on upstat.cuesoft.io | dogfooding (§5 reliability showcase) |

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
