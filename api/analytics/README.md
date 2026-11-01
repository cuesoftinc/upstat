# Upstat Observability (`api/observability`)

Python FastAPI service for reliability insights: analyzes monitor check
history read from `api/common` over HTTP (latency/failure/trend analysis + ML
anomaly scoring) and serves HTTP only on `:8081`: `/health`, `/ready`,
`/analyze...` and `/insights/{monitor_id}`. Optional LLM summaries via Groq.

## Layout

```
app/main.py           FastAPI + lifespan
app/config.py         env loading
router/               HTTP routes
service/              insight generation, risk scoring, severity, LLM renderer
analysis/  ml/        statistical analyses + anomaly model (artifacts in ml/models/, git-ignored)
repository/  model/   monitor API client, Mongo access + domain models
```

## Run

From the repo root (recommended): `make up` → :8081.
Natively: `pip install -r requirements.txt && uvicorn app.main:app --port 8081`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `API_URL` | Base URL of `api/common` (default `http://localhost:8080`) |
| `API_TOKEN` | Optional Bearer session token sent to `api/common` |
| `API_CHECK_LIMIT` | Recent checks fetched per monitor (default 50) |
