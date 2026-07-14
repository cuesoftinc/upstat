# Upstat Observability (`api/observability`)

Python FastAPI service for reliability insights: analyzes monitor check
history from MongoDB (latency/failure/trend analysis + ML anomaly scoring)
and serves gRPC (`:50051`) consumed by `api/common`, plus HTTP `/health` +
`/ready` (`:8081`). Optional LLM summaries via Groq.

## Layout

```
app/main.py           FastAPI + lifespan (starts the internal gRPC server)
app/config.py         env loading
router/               HTTP routes + gRPC server
service/              insight generation, risk scoring, severity, LLM renderer
analysis/  ml/        statistical analyses + anomaly model (artifacts in ml/models/, git-ignored)
repository/  model/   Mongo access + domain models
proto/                generated stubs
```

## Run

From the repo root (recommended): `make up` → :8081.
Natively: `pip install -r requirements.txt && uvicorn app.main:app --port 8081`.
