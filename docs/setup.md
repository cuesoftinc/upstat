# Local Setup

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose (recommended path)
- For native development: Go 1.26+ (`api/common`, `api/query`), Python 3.12+
  (`api/analytics`, `functions/probe`), Node.js 24 (`api/observability`,
  `web`; see `web/.nvmrc`)

## Configuration

Never commit secrets. Provide configuration through environment variables;
each service ships a `.env.example`, and the root `.env.example` covers
compose. Compose has a working default for everything except Google
sign-in. The full list of names is in
[system-design.md §10.3](system-design.md#103-environment-variables-names-only).

| Variable | Used by | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | common | Google OAuth client for sign-in |
| `GOOGLE_REDIRECT_URI` | common | Callback registered with Google; in compose it returns through the web proxy: `http://localhost:3000/api/v1/auth/sso/google/callback` |
| `JWT_SECRET` | common, query | Signs and verifies session tokens (32+ characters) |
| `SESSION_SECRET` | common | Seals the one-time sign-in handoff (32+ characters) |
| `DATABASE_URL` | common | Postgres, as the non-superuser app role (row-level security) |
| `CLICKHOUSE_URL` | common (migrations), query (reads) | ClickHouse HTTP interface |
| `KAFKA_BROKERS` (+ SASL settings in cloud) | every service | The shared message bus |
| `STORAGE_*` | every service | Bucket for config snapshots, claim-check payloads, postmortems |
| `REDIS_HOST` | common, observability, analytics | Rate limits, quotas, salts, evaluator state |
| `PROBE_URLS` | common | `region=url,…`, one probe per region |
| `INTERNAL_TOKEN` | common, query, analytics, probe | Service-to-service auth off Cloud Run |
| `BREVO_API_KEY` / `BREVO_FROM_EMAIL` | analytics | Email alert channels |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | analytics | Self-host insight narratives (cloud uses Vertex AI) |

## Quick start (Docker)

```bash
cp .env.example .env
make up        # stores, the collector, the probe, every service and the web
make logs      # follow logs
make down      # stop
```

| Service | URL | Health |
| --- | --- | --- |
| Web (and the `/api/v1` proxy) | http://localhost:3000 | `/` |
| api/common | http://localhost:8080 | `/health`, `/ready` |
| api/observability (OTLP/HTTP, events) | http://localhost:8081 · OTLP/gRPC `localhost:4317` | `/health`, `/ready` |
| api/analytics | http://localhost:8082 | `/health`, `/ready` |
| api/query | http://localhost:8083 | `/health`, `/ready` |
| probe | http://localhost:8090 | `/health` |
| ClickHouse | http://localhost:8123 | `/ping` |

Point an OpenTelemetry SDK at the gateway with an ingestion token from
Settings → API keys:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8081
OTEL_EXPORTER_OTLP_HEADERS=Upstat-Ingest-Key=uk_live_…
```

## Running natively (without Docker)

Start the stores with `docker compose up -d postgres clickhouse kafka kafka-init redis seaweedfs otel-collector probe`,
then each service from its directory:

```bash
cd api/common && cp .env.example .env && go run ./cmd/server
cd api/query && go run ./cmd/server                      # reads its env from the shell
cd api/observability && cp .env.example .env && npm install && npm run dev
cd api/analytics && cp .env.example .env && pip install -r requirements.txt && uvicorn app.main:app --port 8082
cd web && npm install && npm run dev                     # TEST_MODE: NEXT_PUBLIC_TEST_MODE=true
```

## Tests

| Unit | Command | Needs |
| --- | --- | --- |
| api/common | `go test ./...` | `TEST_DATABASE_URL` (a superuser URL; tests make their own role and database), optional `CLICKHOUSE_TEST_URL` |
| api/query | `go test ./...` | optional `CLICKHOUSE_TEST_URL` for the integration suite |
| api/observability | `npm test` | — |
| api/analytics | `pytest` | — (`CONTRACT_DIR` defaults to `../common/contract`) |
| functions/probe | `pytest` | — |
| web | `npm test`, `npm run test:e2e` | — |

## Docs site

The docs in this folder are published with GitBook's Git Sync. Two files at
the repository root configure it: `gitbook-docs.yaml` names the site and
maps its space to the repository, and `.gitbook.yaml` points that space at
`docs/`, with `overview.md` as the first page and `SUMMARY.md` as the
navigation.
