# Upstat Analytics (`api/analytics`)

Python FastAPI service for reliability decisions: evaluates check results read
through `api/query` (ClickHouse), dispatches alerts and generates ML anomaly
insights. It owns no store; config arrives as snapshots and decisions go back
to `api/common` over shared Kafka lanes. Serves HTTP on `:8082` (`/health`,
`/ready`, `/jobs/*`). Narratives use Vertex AI in cloud or Groq/Gemini locally.

## Layout

```
app/main.py           FastAPI + lifespan
app/config.py         env loading
router/               HTTP routes
service/              insight generation, risk scoring, severity, LLM renderer
analysis/  ml/        statistical analyses + anomaly model (artifacts in ml/models/, git-ignored)
queryclient.py  bus/  telemetry via api/query, Kafka lanes + domain models
```

## Run

From the repo root (recommended): `make up` → :8082.
Natively: `pip install -r requirements.txt && uvicorn app.main:app --port 8082`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `KAFKA_BROKERS` | Kafka brokers for the shared config/result lanes |
| `QUERY_URL` | Base URL of `api/query` (default `http://localhost:8083`) |
| `INTERNAL_TOKEN` | Shared secret for internal `api/query` and `api/common` calls |
| `STORAGE_*` | Object store for insight artifacts (GCS in cloud, S3 locally) |
| `REDIS_HOST` | Evaluator working state; empty keeps it in memory (one instance) |
| `BREVO_API_KEY` / `BREVO_FROM_EMAIL` | Email notification channel (X-7) |
| `GOOGLE_CLOUD_PROJECT` / `GROQ_API_KEY` / `GEMINI_API_KEY` | Insight narrative provider (X-4) |

See `.env.example` for the full native-run set.
