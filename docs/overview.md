# Overview

Upstat is an open-source uptime and status monitoring platform. It schedules
health checks against services, records incidents, serves status pages, and
generates ML-powered reliability insights.

## Architecture

```
client                     proxy               server                    data
──────                     ─────               ──────                    ────
web dashboard   ─gRPC-Web─▶ Envoy   ──gRPC──▶  common api (Go)   ──────▶  MongoDB
(Next.js)                                      · monitor worker           ▲
                                               · checks / incidents       │
                                               · MonitorService (gRPC)     │
                                       gRPC     observability (Python) ────┘
                                    GetRecentChecks · ML anomaly detection
                                                     · insight generation
```

- **`web`** — Next.js dashboard and public status pages. Talks to the backend
  over **gRPC-Web**.
- **Envoy** — front proxy at [deploy/helm/envoy/envoy.yaml](../deploy/helm/envoy/envoy.yaml).
  Translates browser gRPC-Web into native gRPC for the Go backend and applies
  CORS.
- **`api/common`** — Go gRPC backend: `MonitorService` and `UserService`, the
  internal monitor worker that schedules periodic checks, and persistence of
  monitors, check results, and incidents.
- **`api/observability`** — Python (FastAPI + gRPC) service: a gRPC client of
  the Go backend that pulls recent checks, runs anomaly detection and insight
  generation, and persists insights.
- **Data** — MongoDB stores monitors, check results, incidents, and insights.
- **Auth** — Google sign-in (`GOOGLE_CLIENT_ID`) plus JWTs issued by the Go
  backend; services authenticate to each other with a gRPC auth token.

The key architectural boundary: the Go backend owns operational monitoring
(scheduling, checks, state), and the observability service owns analytics and
machine learning, consuming the backend through a clear gRPC interface.

See [setup.md](setup.md) to run the stack locally, [architecture.md](architecture.md)
for detailed data flows, and the
[repository structure](../README.md#repository-structure) in the README.

## Product & design documentation

- [prd.md](prd.md) — product requirements breakdown (triple mandate: monitoring, analytics, ecosystem tracking)
- [architecture.md](architecture.md) — current system + PRD-phase target design (events layer, alerting)
- [data-model.md](data-model.md) — current + target entities, retention & privacy defaults
- [api.md](api.md) — gRPC surface map + the /v1/events ecosystem contract ("D2")
- [roadmap.md](roadmap.md) — phased plan; Phase 1 unblocks apparule/expendit analytics
- [design.md](design.md) + [pages.md](pages.md) — design language, pillars, microinteractions
- [query-grammar.md](query-grammar.md) — the shared query grammar behind explorers, widgets, monitors
- [decisions.md](decisions.md) — the open-decision register: ratify to unblock phases
- [deployment.md](deployment.md) — Cloud Run + App Hosting contract (cuesoft-iac provisioning, CI/CD pattern)
- flows/ — feature flow specs with edge cases: [auth](flows/auth.md), [monitor](flows/monitor.md), [alert](flows/alert.md)
