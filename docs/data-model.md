# Upstat — Data Model

> Companion to [prd.md](prd.md) / [architecture.md](architecture.md).
> Markers: **[Current]**, **[PRD]**, **[Proposed]**.

## 1. Current entities **[Current]** (MongoDB, database `Upstat`)

```mermaid
erDiagram
    USER ||--o{ MONITOR : owns
    MONITOR ||--o{ CHECK_RESULT : produces
    MONITOR ||--o{ INCIDENT : "opens/closes"
    MONITOR ||--o{ MONITOR_INSIGHT : "analyzed into"
    SERVICE_TOKEN }o--|| USER : "issued for s2s"

    USER {
        objectid _id PK
        string name
        string email
        string password_hash
        datetime created_at
    }
    MONITOR {
        objectid _id PK
        string ownerId
        string name
        string target "URL"
        string type "website | server | api | blog"
        bool active
        string status "up | down | pending | nodata | paused (flows/monitor.md §2)"
        datetime created_at
        datetime updated_at
        int intervalSeconds
        int timeoutSeconds
        int failureThreshold
        int consecutiveFailures
        datetime lastCheckedAt
        int lastResponseTimeMs
        int lastStatusCode
    }
    CHECK_RESULT {
        objectid _id PK
        objectid monitor_id FK
        bool up
        int status_code
        int response_time_ms
        datetime checked_at
    }
    INCIDENT {
        objectid _id PK
        objectid monitor_id FK
        datetime started_at
        datetime resolved_at "null while open"
        string cause
    }
    MONITOR_INSIGHT {
        objectid _id PK
        string monitor_id
        float risk_score
        string severity
        json signals "failure/latency/trend analyses"
        string narrative "LLM-rendered (Groq)"
        datetime generated_at
    }
    SERVICE_TOKEN {
        objectid _id PK
        string name "e.g. observability"
        string token_hash
        datetime created_at
    }
```

(Field lists are representative of `internal/model/*.go` + repository structs;
insight shape comes from the observability service's generator.)

## 2. Target additions **[Proposed]** — the analytics/events layer (M2/M3)

```mermaid
erDiagram
    USER ||--o{ PROPERTY : owns
    PROPERTY ||--o{ EVENT : receives
    PROPERTY ||--o{ ROLLUP : "aggregated into"
    MONITOR ||--o{ ALERT_RULE : "guarded by"
    ALERT_RULE }o--o{ ALERT_CHANNEL : notifies

    PROPERTY {
        objectid _id PK
        string ownerId
        string name "e.g. apparule.cuesoft.io"
        string public_key "format pk_<8 random bytes hex>; write-only"
        string previous_key "valid 24h after rotation (grace overlap) — the rotation contract"
        json allowed_origins "CORS allowlist for beacons"
        datetime created_at
    }
    EVENT {
        objectid _id PK
        objectid property_id FK
        string name "page_view | demo_start | upload_success | ..."
        json dims "coarse dimensions only: path, referrer_host, country, device_class"
        datetime ts
        string visitor_hash "daily-rotating anonymous hash, no cookie"
    }
    ROLLUP {
        objectid _id PK
        objectid property_id FK
        string period "hour | day"
        datetime bucket
        string name
        json dims
        int count
        int uniques "approx, from visitor_hash"
    }
    ALERT_RULE {
        objectid _id PK
        objectid monitor_id FK
        string on "down | recovered | nodata | all"
        json channel_ids "linked ALERT_CHANNELs"
        int cooldown_minutes
        int renotify_minutes "0 = off (default)"
    }
    DISPATCH {
        objectid _id PK
        objectid rule_id FK
        objectid channel_id FK
        json transition
        string state "pending | delivered | failed"
        int attempts
        datetime next_attempt_at
    }
    VISIT_ROLLUP {
        objectid _id PK
        objectid property_id FK
        string period "hour | day"
        datetime bucket
        int visits
        int bounce_visits
        int total_visit_seconds
    }
    ALERT_CHANNEL {
        objectid _id PK
        string ownerId
        string kind "email | webhook"
        json config "address / url + secret"
        bool verified
    }
```

Modeling notes:

- **`EVENT.dims` is a closed, validated vocabulary** — the schema is the
  privacy boundary (prd.md §6): free-form payloads are rejected at ingest so
  sibling products *cannot* leak financial/measurement data into analytics
  even by accident.
- **`visitor_hash`**: cookieless uniques via
  `hash(daily_salt, property, ip, user_agent)`; the salt rotates daily and raw
  IPs are never stored. **[Proposed — the privacy-defining choice, ratify]**
- **Rollups are the query surface**; raw `EVENT` rows exist to rebuild rollups
  and are the first thing retention deletes.
- **Alerting is monitor-scoped** with owner-scoped reusable channels; email
  requires a provider decision (prd.md §8.2 — old SMTP plumbing was
  deliberately removed and should return via one well-chosen provider).

## 3. Storage mapping

| Concern | Choice | Rationale |
| --- | --- | --- |
| Everything current | MongoDB (`Upstat` db) **[Current]** | as-is until the control-plane→**Postgres** migration (X-5, with the monitors-v2/OBS work) |
| Events + rollups | Phase 1: control-plane store (**Postgres** partitioned tables + scheduled retention job, per X-5) | folds into **ClickHouse** when OBS-001 lands (U-1); the TTL-index shortcut died with the Mongo control plane |
| Alert dispatch state | control-plane store (rule cooldown timestamps) | avoids a queue dependency at this scale |

## 4. Retention & privacy **[Proposed defaults, to ratify + publish per UPS-003/005]**

| Data | Retention | Notes |
| --- | --- | --- |
| Raw events | 90 days (TTL) | rollups carry the history |
| Rollups (hour) | 90 days | day rollups cover longer horizons |
| Rollups (day) | 13 months | year-over-year comparisons |
| Check results | 90 days | insights summarize older history |
| Incidents | indefinite | they are the historical record |
| Visitor identifiers | never stored raw | `visitor_hash` only, daily-rotating |

| Class | Data | Rules |
| --- | --- | --- |
| Visitor data | events, visitor_hash | cookieless, anonymized, no cross-property joins; disclosed on the privacy page (UPS-005) |
| Customer data | monitors, targets, alert configs | targets may embed internal hostnames — treat as confidential |
| Operational | checks, rollups, insights | safe for internal metrics |

---

## 5. Observability platform entities (2026-07-16) **[Proposed]**

Control plane additions (**Aiven Postgres** per X-5; entity names keep their shapes):

```mermaid
erDiagram
    ORG ||--o{ INGEST_KEY : issues
    ORG ||--o{ DASHBOARD : owns
    DASHBOARD ||--o{ WIDGET : arranges
    ORG ||--o{ MONITOR_RULE : defines
    MONITOR_RULE }o--o{ ALERT_CHANNEL : notifies
    ORG ||--o{ SLO : tracks
    ORG ||--o{ INCIDENT_V2 : manages
    INCIDENT_V2 ||--o{ TIMELINE_ENTRY : logs
    ORG ||--o{ SERVICE_ENTRY : catalogs

    ORG { objectid _id PK
        string name
        string timezone "IANA tz, default UTC - set at org creation, editable in Settings (pages.md B12)"
        datetime created_at }
    INGEST_KEY { objectid _id PK
        objectid org_id FK
        string scope "otlp|rum|statsd|all"
        string key_hash
        json quotas }
    DASHBOARD { objectid _id PK
        objectid org_id FK
        string name
        json layout "12-col grid"
        json template_vars }
    WIDGET { objectid _id PK
        objectid dashboard_id FK
        string type "timeseries|query_value|toplist|table|heatmap|logstream|slo|status|servicemap|markdown"
        json query "shared grammar"
        json viz_options }
    MONITOR_RULE { objectid _id PK
        objectid org_id FK
        string signal "uptime|metric|log|trace|slo_burn"
        json query
        json thresholds "warn/crit + window"
        json notify "channels, renotify, mute_windows" }
    SLO { objectid _id PK
        objectid org_id FK
        string sli_source "check|metric_ratio|latency"
        float target "e.g. 99.9"
        string window "30d rolling" }
    INCIDENT_V2 { objectid _id PK
        objectid org_id FK
        int sev "1..4"
        string status "declared|mitigated|resolved"
        json roles "commander, responders"
        string postmortem_key "Cloud Storage: upstat/postmortems/{org}/{incident}.md" }
    SERVICE_ENTRY { objectid _id PK
        objectid org_id FK
        string name
        string owner
        json links "repo, runbook"
        json environments }
```

Identity posture (X-10, ratified 2026-07-16 — [decisions.md](decisions.md)):
upstat is **tier 0 + tier-1-minimal** — Google identity (X-1) plus exactly
one profile field, `ORG.timezone` (IANA, default `UTC`; set at org creation,
editable in Settings, pages.md B12). It exists so report rendering and
time-bucketing *display* resolve in the org's timezone while storage and
rollups stay UTC ([analytics-math.md](analytics-math.md) §3). The `country`
in `EVENT.dims` (§2) is a coarse *event* dimension, **not** org identity —
no address or country identity field exists. Tier 2 (provider-verified
financial identity) is N/A until billing enters the PRD.

### Telemetry-plane DDL sketch (ClickHouse, U-1 — draft to finalize at OBS-001)

```sql
CREATE TABLE metrics_points (
  org_id LowCardinality(String), series_hash UInt64,
  name LowCardinality(String), tags Map(String, String),
  ts DateTime64(3), value Float64
) ENGINE = MergeTree
  PARTITION BY toYYYYMM(ts)
  ORDER BY (org_id, series_hash, ts)
  TTL toDateTime(ts) + INTERVAL 13 MONTH;

CREATE TABLE logs (
  org_id LowCardinality(String), service LowCardinality(String),
  level LowCardinality(String), ts DateTime64(3),
  message String, attrs Map(String, String), trace_id String
) ENGINE = MergeTree
  PARTITION BY toDate(ts)
  ORDER BY (org_id, service, ts)
  TTL toDateTime(ts) + INTERVAL 15 DAY;

CREATE TABLE spans (
  org_id LowCardinality(String), trace_id String, span_id String,
  parent_id String, service LowCardinality(String), name LowCardinality(String),
  start DateTime64(6), duration_ns UInt64, status UInt8,
  attrs Map(String, String)
) ENGINE = MergeTree
  PARTITION BY toDate(start)
  ORDER BY (org_id, service, start)
  TTL toDateTime(start) + INTERVAL 7 DAY;
```

`org_id` leads every ORDER BY — the tenancy-isolation primitive (queries are
always org-scoped; cross-org reads are structurally awkward by design).

Legacy sketch note (superseded by the DDL above): `metrics_points`
(series-hash, ts, value, tags), `logs` (ts, org, service, level, message,
attrs map, trace_id), `spans` (trace_id, span_id, parent, service, name,
start, duration, status, attrs) — schemas finalized during OBS-001 design.
Retention defaults extend §4's table: metrics 13mo (rollup-thinned), logs
15d hot (+archive later), traces 7d sampled **[Proposed]**.
