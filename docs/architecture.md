# Upstat Architecture

## Overview
This diagram describes the main components of Upstat and how they interact.

```mermaid
flowchart LR
    subgraph Frontend
        UI[Next.js UI / React App]
    end

    subgraph Proxy
        Envoy[Envoy Proxy]
    end

    subgraph Backend
        GoBackend[Go gRPC Backend]
        PythonService[Python Observability Service]
    end

    subgraph Data
        Mongo[MongoDB]
    end

    UI -->|HTTP / API requests| Envoy
    Envoy -->|gRPC / HTTP| GoBackend
    PythonService -->|gRPC| GoBackend
    GoBackend -->|MongoDB reads/writes| Mongo
    PythonService -->|Insight persistence| Mongo
    GoBackend -->|Monitor worker writes check results| Mongo
    UI -->|Reads dashboards/status pages| GoBackend

    click GoBackend "api/common/cmd/server/main.go" "Go gRPC backend entrypoint"
    click PythonService "api/observability/main.py" "Python FastAPI analytics service entrypoint"
    click Mongo "docker-compose.yml" "Database configuration (compose)"
```

## Components

- **Frontend**: Next.js / React application in `web`.
- **Envoy**: Proxy layer in `deploy/helm/envoy/envoy.yaml` and Docker Compose.
- **Go Backend**: gRPC server in `api/common`, exposing `MonitorService` and `UserService`.
- **Python Observability Service**: FastAPI service in `api/observability`, calling Go backend via gRPC to analyze recent monitor checks.
- **MongoDB**: Primary database for monitors, check results, incidents, and insights.

## Communication patterns

- `UI -> Envoy -> GoBackend`: frontend requests route through Envoy.
- `PythonService -> GoBackend`: gRPC client calls using shared proto definitions in `api/common/internal/proto/user.proto`.
- `GoBackend -> Mongo`: persistence for monitors, checks, incidents.
- `PythonService -> Mongo`: insight persistence.

## Notes

- The system is distributed: services run in separate containers/processes and communicate over network protocols.
- The project currently uses Docker Compose for local orchestration.
- The Go backend contains an internal monitor worker that schedules periodic checks.

## Backend + Python Observability Service Details

```mermaid
flowchart LR
    subgraph Backend
        GoServer[Go gRPC Backend]
        MonitorWorker[Monitor Worker]
        Mongo[MongoDB]
    end

    subgraph PythonService
        PythonAPI[Python FastAPI Service]
        InsightGenerator[Insight Generator / ML Pipeline]
        PythonRepo[gRPC Monitor Repository]
        InsightsDB[Insight Storage]
    end

    MonitorWorker -->|writes check results| Mongo
    GoServer -->|reads/writes monitors, incidents, checks| Mongo
    PythonRepo -->|gRPC GetRecentChecks| GoServer
    InsightGenerator -->|reads recent checks| PythonRepo
    InsightGenerator -->|writes insights| InsightsDB
    PythonAPI -->|endpoint triggers| InsightGenerator
    PythonAPI -->|serves insight results| Client[Client / Frontend]

    click GoServer "api/common/cmd/server/main.go" "Go gRPC backend entrypoint"
    click MonitorWorker "api/common/services/monitor_worker.service.go" "Periodic monitor scheduler"
    click PythonRepo "api/observability/repositories/monitor_repository.py" "Python gRPC client for checks"
    click InsightGenerator "api/observability/services/insight_generator.py" "Insight generation pipeline"
```

### Go backend 

1. The Go service starts in `api/common/cmd/server/main.go`, initializing the MongoDB connection and registering the gRPC `MonitorService` and `UserService` handlers.
2. The gRPC API is defined in `api/common/internal/proto/user.proto` and includes `GetRecentChecks`, `GetStatusPage`, and monitor CRUD operations.
3. The internal monitor worker in `api/common/services/monitor_worker.service.go` wakes periodically, loads active monitors, and executes checks concurrently.
4. Check execution is done in `api/common/services/checker.service.go`, which performs the HTTP request, measures response time, and assembles a check result.
5. Check results are persisted through `api/common/repositories/check_result.repositories.go`.
6. Incidents and monitor state are updated through the corresponding repository methods in `api/common/repositories/incident.repositories.go` and `api/common/repositories/monitor.repositories.go`.

### Python observability service 

1. The Python service starts in `api/observability/main.py` and loads env vars from `api/observability/.env`.
2. Its FastAPI routes are defined in `api/observability/api/insights.py` and `api/observability/api/analyze.py`.
3. `GET /insights/{monitor_id}` and `POST /analyze/{monitor_id}` both call `generate_insight(monitor_id)` in `api/observability/services/insight_generator.py`.
4. That generator calls `api/observability/repositories/monitor_repository.py`, which opens a gRPC connection to the Go backend and calls `GetRecentChecks`.
5. The gRPC response is converted into local `MonitorCheck` objects.
6. Feature extraction is performed by `api/observability/ml/feature_builder.py`, producing metrics such as failed checks, total checks, and average response time.
7. Risk scoring and anomaly classification are performed by `api/observability/services/risk_scorer.py`, `services/severity_classifier.py`, and `services/anomaly_detector.py`.
8. Human-readable signals are generated by `api/observability/analysis/failure_analysis.py`, `latency_analysis.py`, and `trend_analysis.py`.
9. The final `Insight` object is saved through `api/observability/repositories/insight_repository.py` and returned to the caller.

### Why this is useful

- The Go backend owns monitor state and check execution, making it the authoritative source for recent monitor health.
- The Python service owns analytics and machine learning, consuming the Go service via a clear gRPC interface.
- The system separates operational monitoring from analysis, which is the key architectural boundary.
