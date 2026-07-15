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
        string status "up | down | ..."
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
        string public_key "write-only ingest key, rotatable"
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
        string on "down | recovered | both"
        int cooldown_minutes
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
| Everything current | MongoDB (`Upstat` db) **[Current]** | as-is |
| Events + rollups | MongoDB collections with TTL indexes **[Proposed]** | "lightweight architecture" (§5): no new datastore; TTL indexes give free retention enforcement; revisit only if volume demands it |
| Alert dispatch state | Mongo (rule cooldown timestamps) | avoids a queue dependency at this scale |

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
