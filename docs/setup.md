# Local Setup

## Prerequisites

- Go 1.25+ (see `api/common/go.mod`) — backend
- Python 3.11+ — `api/observability`
- Node.js (see `web/.nvmrc`) — `web`
- MongoDB — primary datastore
- Envoy — gRPC-Web proxy (typically run via Docker)

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
| `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP credentials for notifications |
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

## Running services

```bash
# Go backend
cd api/common && cp .env.example .env && go run .

# Python observability service
cd api/observability && cp .env.example .env \
  && pip install -r requirements.txt \
  && uvicorn main:app --reload

# Web (dashboard + status pages)
cd web && npm install && npm run dev

# Envoy (gRPC-Web -> gRPC proxy)
envoy -c deploy/helm/envoy/envoy.yaml
```

The browser reaches the backend through Envoy (gRPC-Web), so Envoy must be
running for the web app to talk to `api/common`.

Common tasks are also wired into the root [Makefile](../Makefile)
(`make setup`, `make api`, `make obs`, `make web`).
