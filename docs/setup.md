# Local Setup

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose (recommended path)
- For native development: Go 1.25+ (see `api/common/go.mod`), Python 3.11+
  (`api/observability`), Node.js (see `web/.nvmrc`), MongoDB, and Envoy (gRPC-Web proxy)

## Configuration

Never commit secrets. Provide configuration via environment variables; each
service ships a `.env.example` to copy from.

### `api/common` (Go backend)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for sign-in |
| `JWT_SECRET` | Secret used to sign/verify JWTs |
| `BASE_URL` | Public base URL of the backend |
| `INSIGHT_SERVICE_GRPC_ADDRESS` | Address of the observability gRPC server |

### `api/observability` (Python service)

| Variable | Description |
|----------|-------------|
| `UPSTAT_GRPC_ADDRESS` | Address of the Go backend gRPC server |
| `UPSTAT_GRPC_AUTH_TOKEN` | Auth token presented to the Go backend |
| `UPSTAT_GRPC_CHECK_LIMIT` | Max recent checks to request per monitor |
| `MONGO_URI` / `MONGO_DB` | MongoDB connection string and database name |
| `GROQ_API_KEY` | API key for LLM-rendered insights |
| `GRPC_PORT` | Port the observability gRPC server listens on |
| `ENABLE_GRPC_SERVER` | Toggle the embedded gRPC server (`true`/`false`) |

## Quick start (Docker)

```bash
cp .env.example .env
make up        # build + start mongo, api-common (:8080), api-observability (:8081), envoy (:8082), web (:3000)
make logs      # follow logs
make down      # stop
```

- API (common): http://localhost:8080 — health `/health`, readiness `/ready`
- API (observability): http://localhost:8081 — health `/health`, readiness `/ready`
- gRPC-Web proxy (Envoy): http://localhost:8082
- Web: http://localhost:3000

## Running natively (without Docker)

```bash
# Go backend — listens on :8080 (override with PORT)
cd api/common && cp .env.example .env && go run ./cmd/server

# Python observability service
cd api/observability && cp .env.example .env \
  && pip install -r requirements.txt \
  && uvicorn main:app --reload

# Web (dashboard + status pages)
cd web && npm install && npm run dev

# Envoy (gRPC-Web -> gRPC proxy) — the browser reaches the backend through Envoy,
# so it must be running for the web app to talk to api/common
envoy -c deploy/helm/envoy/envoy.yaml
```
