# Overview

Upstat is an open-source uptime and status monitoring platform. It schedules
health checks against services, records incidents, serves status pages, and
generates ML-powered reliability insights.

## Architecture

```mermaid
flowchart LR
    WEB[web dashboard<br/>Next.js] -->|proxies /api/v1/*| AC[api/common · Go<br/>monitor worker · checks · incidents<br/>monitors · users]
    SCH[Cloud Scheduler] -->|run-checks, OIDC| AC
    OBS[api/observability — Python<br/>ML anomaly detection · insights] -->|HTTP GET checks| AC
    AC --> MG[(MongoDB)]
    OBS --> MG
```

- **`web`** — Next.js dashboard and public status pages. Currently serves
  dashboard data from its in-app mock CRUD server (`/api/mock/v1`); talking
  to the backend through the web's `/api/v1/*` proxy is the target control
  plane (not yet wired).
- **Cloud Scheduler**: job `upstat-run-checks` calls `POST /internal/jobs/run-checks` on api/common every minute.
- **`api/common`** — Go HTTP backend (port 8080, h2c): auth, monitor and
  status page routes, the internal monitor worker that schedules periodic checks, and persistence of
  monitors, check results, and incidents.
- **`api/observability`** — Python (FastAPI) service: an HTTP client of
  the Go backend (`API_URL`) that pulls recent checks, runs anomaly detection and insight
  generation, and persists insights.
- **Data** — MongoDB stores monitors, check results, incidents, and insights.
- **Auth**: Google single sign-on run by the Go backend (PKCE, one-time
  handoff code, session JWT and cookie); the observability service calls the Go backend with an optional Bearer session token (`API_TOKEN`).

The key architectural boundary: the Go backend owns operational monitoring
(scheduling, checks, state), and the observability service owns analytics and
machine learning, consuming the backend through its HTTP API.

See [setup.md](setup.md) to run the stack locally, [architecture.md](architecture.md)
for detailed data flows, and the
[repository structure](https://github.com/cuesoftinc/upstat#repository-structure) in the README.

## Product & design documentation
> Published site: **https://cuesoft.gitbook.io/upstat** (Git-synced from this folder on every merge to main).


- [prd.md](prd.md) — product requirements breakdown (triple mandate: monitoring, analytics, ecosystem tracking)
- [architecture.md](architecture.md) — current system + PRD-phase target design (events layer, alerting)
- [data-model.md](data-model.md) — current + target entities, retention & privacy defaults
- [api.md](api.md) — HTTP surface map + the /v1/events ecosystem contract ("D2")
- [roadmap.md](roadmap.md), phased plan; Phase 1 unblocks sibling-product analytics
- [design.md](design.md) + [pages.md](pages.md) — design language, pillars, microinteractions
- [query-grammar.md](query-grammar.md) — the shared query grammar behind explorers, widgets, monitors
- [decisions.md](decisions.md) — the open-decision register: ratify to unblock phases
- [deployment.md](deployment.md), Cloud Run + App Hosting contract (infrastructure-as-code provisioning, CI/CD pattern)
- flows/ — feature flow specs with edge cases: [auth](flows/auth.md), [monitor](flows/monitor.md), [alert](flows/alert.md)
- [analytics-math.md](analytics-math.md) — visitor hashing, sessionization, rollups, uniques honesty rules
- [engineering.md](engineering.md) — error catalog, authz matrix, rate limits, testing strategy, logging rules
- [features.md](features.md) — granular build backlog (stable unit IDs per phase)
