# Upstat — Data Model

> Companion to [prd.md](prd.md) / [architecture.md](architecture.md).
> Markers: **[Current]**, **[PRD]**, **[Proposed]**.

## 1. Current entities **[Current]** — Postgres control plane + ClickHouse telemetry

The control plane lives in Postgres; every tenant table carries `org_id` and
row-level security, and `api/common` is its only client. Check results and
telemetry live in ClickHouse and are read through `api/query`.

```mermaid
erDiagram
    USER ||--o{ MEMBER : "joins via"
    ORG ||--o{ MEMBER : has
    ORG ||--o{ MONITOR : owns
    MONITOR ||--o{ TRANSITION : produces
    MONITOR ||--o{ INCIDENT : "opens/closes"
    MONITOR ||--o{ INSIGHT : "analyzed into"
    ORG ||--o{ INGEST_KEY : issues
    ORG ||--o{ RULE : owns
    RULE ||--o{ DELIVERY : dispatches

    USER {
        uuid id PK
        text email UK
        text name
        uuid active_org_id FK
        timestamptz created_at
    }
    ORG {
        uuid id PK
        text name
        text timezone
        timestamptz created_at
    }
    MEMBER {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        text role "owner | admin | member | viewer"
        text status "active | invited | disabled"
    }
    MONITOR {
        uuid id PK
        uuid org_id FK
        text name
        text target "URL"
        text type "website | server | api | blog"
        boolean active
        text status "up | down | pending | nodata | paused (flows/monitor.md §2)"
        integer interval_s
        integer timeout_s
        integer failure_threshold
        integer consecutive_failures
        text_array regions
        integer min_failing_regions
        timestamptz next_run_at
        timestamptz last_checked_at
        integer last_response_time_ms
        integer last_status_code
    }
    TRANSITION {
        uuid id PK
        uuid org_id FK
        uuid monitor_id FK
        bigint seq
        text from_status
        text to_status
        text cause
        timestamptz at
    }
    INCIDENT {
        uuid id PK
        uuid org_id FK
        integer number
        text title
        integer sev "1-4"
        text status "investigating | identified | monitoring | resolved"
        uuid monitor_id FK
        timestamptz started_at
        timestamptz resolved_at "null while open"
    }
    INSIGHT {
        uuid id PK
        uuid org_id FK
        uuid monitor_id FK
        integer risk_score
        text severity
        boolean anomaly_detected
        text narrative
        text recommended_action
        timestamptz generated_at
    }
    INGEST_KEY {
        uuid id PK
        uuid org_id FK
        text kind "ingestion_token | property_key"
        text scope "otlp | rum | statsd | all"
        text key_hash "sha256; plaintext shown once"
        text key_masked
        jsonb allowed_origins
        jsonb quotas
        text status "active | rotation_grace | revoked"
    }
    RULE {
        uuid id PK
        uuid org_id FK
        text name
        text signal "uptime | metric | log | trace | slo_burn"
        jsonb thresholds
        jsonb notify
        text state "ok | warn | alert | nodata"
    }
    DELIVERY {
        uuid id PK
        uuid org_id FK
        uuid transition_id FK
        uuid rule_id FK
        uuid channel_id FK
        text kind "alert | flapping | renotify | verify | rule"
        text state "delivered | failed | suppressed"
        integer attempts
        timestamptz at
    }
```

ClickHouse holds the high-volume tables; the collector loads them and
`api/query` reads them:

| Table | Key columns | Retention |
| --- | --- | --- |
| `check_results` | `org_id`, `monitor_id`, `tick_id`, `region`, `checked_at`, `ok`, `status_code`, phase timings | 90 days |
| `check_uptime_daily` | `org_id`, `monitor_id`, `day`, uptime aggregate | 13 months |
| `events` | `org_id`, `name`, `ts`, `dims`, `visitor_hash` | 90 days |
| `events_hourly` / `events_daily` | `org_id`, `bucket`, `name`, `events`, exact `uniques` (`uniqExact`) | 90 days / 13 months |
| `otel_logs`, `otel_metrics_*` | standard OTel columns plus `org_id` row policies | 15 days |
| `otel_traces` | standard OTel columns plus `org_id` row policies | 7 days |
| `metrics_1m` / `metrics_1h` | `org_id`, `bucket`, metric aggregates | 90 days / 13 months |

(Field lists are representative; see `api/common/migrations/postgres/*.sql` and
`api/common/migrations/clickhouse/*.sql` for the full DDL.)

## 2. Additions **[Current]** — the analytics/events layer

The ingest and alerting additions live in Postgres; event, rollup and check
result rows live in ClickHouse (§1). `api/common` owns the Postgres rows,
the ingest gateway forwards events to the collector, and `api/analytics`
owns the decisions.

```mermaid
erDiagram
    ORG ||--o{ INGEST_KEY : issues
    ORG ||--o{ EVENT_REGISTRY : declares
    ORG ||--o{ RULE : owns
    RULE }o--o{ CHANNEL : notifies
    RULE ||--o{ DELIVERY : dispatches

    INGEST_KEY {
        uuid id PK
        uuid org_id FK
        text kind "ingestion_token | property_key"
        text scope "otlp | rum | statsd | all"
        text key_hash "sha256; plaintext shown once"
        text previous_hash "valid 24h after rotation (grace overlap)"
        jsonb allowed_origins "CORS allowlist for beacons"
        jsonb quotas
        text status "active | rotation_grace | revoked"
    }
    EVENT_REGISTRY {
        uuid id PK
        uuid org_id FK
        text name
        text_array dims "closed vocabulary"
        boolean unique_ineligible
    }
    RULE {
        uuid id PK
        uuid org_id FK
        text name
        text signal "uptime | metric | log | trace | slo_burn"
        jsonb query
        text query_string "SQL/pipe expression for non-uptime signals"
        jsonb thresholds
        jsonb notify
        text state "ok | warn | alert | nodata"
    }
    CHANNEL {
        uuid id PK
        uuid org_id FK
        text kind "email | webhook"
        text target
        text secret "webhook signing secret"
        text health "unverified | verified | degraded"
    }
    DELIVERY {
        uuid id PK
        uuid org_id FK
        uuid rule_id FK
        uuid channel_id FK
        text kind "alert | flapping | renotify | verify | rule"
        text state "delivered | failed | suppressed"
        integer attempts
        timestamptz at
    }
```

`EVENT`, `ROLLUP` and `VISIT_ROLLUP` are ClickHouse tables, not Postgres rows:
events carry `name`, closed `dims`, `ts` and `visitor_hash`; hourly/daily
rollups carry the `org_id`, `bucket`, `events` and exact-within-bucket
`uniques` (`uniqExact`), never added across buckets. Check results are the
`check_results` table in the same store.

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
- **Alerting rules are org-scoped** (`rules.org_id`), not stored on a monitor;
  non-uptime rules are evaluated org-wide (uptime rules still react to a
  monitor's transitions). Channels are reusable and org-scoped; email requires
  a provider decision (prd.md §8.2 — old SMTP plumbing was deliberately
  removed and should return via one well-chosen provider).

## 3. Storage mapping

| Concern | Choice | Rationale |
| --- | --- | --- |
| Control plane | **Postgres** (`upstat` db, row-level security) **[Current]** | users, orgs, monitors, transitions, incidents, rules, channels, deliveries, insights; `api/common` is the only client |
| Events + rollups | **ClickHouse** tables loaded by the OTel Collector **[Current]** | events and rollups are high-volume and TTL-managed; read through `api/query` |
| Check results | **ClickHouse** `check_results` **[Current]** | probe results land here via the collector; Postgres keeps only the latest status fields on `monitors` |
| Alert dispatch state | Postgres `deliveries` (rule cooldown timestamps) | avoids a queue dependency at this scale |

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

Control plane additions (**managed Postgres** per X-5; entity names keep their shapes):

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

    ORG { uuid id PK
        text name
        text timezone "IANA tz, default UTC - set at org creation, editable in Settings (pages.md B12)"
        timestamptz created_at }
    INGEST_KEY { uuid id PK
        uuid org_id FK
        text scope "otlp|rum|statsd|all"
        text key_hash
        jsonb quotas }
    DASHBOARD { uuid id PK
        uuid org_id FK
        text name
        jsonb layout "12-col grid"
        jsonb template_vars }
    WIDGET { uuid id PK
        uuid dashboard_id FK
        text type "timeseries|query_value|toplist|table|heatmap|logstream|slo|status|servicemap|markdown"
        jsonb query "shared grammar"
        jsonb viz_options }
    MONITOR_RULE { uuid id PK
        uuid org_id FK
        text signal "uptime|metric|log|trace|slo_burn"
        jsonb query
        jsonb thresholds "warn/crit + window"
        jsonb notify "channels, renotify, mute_windows" }
    SLO { uuid id PK
        uuid org_id FK
        text sli_source "check|metric_ratio|latency"
        float8 target "e.g. 99.9"
        text window "30d rolling" }
    INCIDENT_V2 { uuid id PK
        uuid org_id FK
        integer sev "1..4"
        text status "declared|mitigated|resolved"
        jsonb roles "commander, responders"
        text postmortem_key "Cloud Storage: upstat/postmortems/{org}/{incident}.md" }
    SERVICE_ENTRY { uuid id PK
        uuid org_id FK
        text name
        text owner
        jsonb links "repo, runbook"
        jsonb environments }
```

Identity posture (X-10, ratified 2026-07-16, [decisions.md](decisions.md)):
upstat is **tier 0 + tier-1-minimal**, Google identity (X-1) plus exactly
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

Retention defaults extend §4's table: metrics 13mo (rollup-thinned), logs
15d hot (+archive later), traces 7d sampled **[Proposed]**; schemas are
finalized during OBS-001 design.
