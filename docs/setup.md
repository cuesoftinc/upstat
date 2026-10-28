# Local Setup

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose (recommended path)
- For native development: Go 1.26+ (see `api/common/go.mod`), Python 3.12+
  (`api/observability`), Node.js 24 (see `web/.nvmrc`), MongoDB

## Configuration

Never commit secrets. Provide configuration via environment variables; each
service ships a `.env.example` to copy from.

### `api/common` (Go backend)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `MONGO_DB` | MongoDB database name (e.g. `Upstat`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | API callback registered with Google (`<api>/v1/auth/sso/google/callback`) |
| `JWT_SECRET` | Secret used to sign/verify session JWTs (at least 32 characters) |
| `JWT_ACCESS_TTL` | Session token lifetime as a Go duration (default `24h`) |
| `JWT_EXPIRY_HOURS` | Session lifetime in hours; used when `JWT_ACCESS_TTL` is unset |
| `SESSION_SECRET` | Secret that seals the one-time sign-in handoff (at least 32 characters) |
| `SESSION_COOKIE_NAME` | Session cookie name (default `upstat_session`) |
| `OAUTH_STATE_COOKIE` | Sign-in state cookie name (default `upstat_oauth_state`) |
| `WEB_URL` | Web app origin the API redirects to after sign-in |
| `PUBLIC_URL` | Public base URL of the backend |
| `SERVICE_TOKEN_HASH` | Future/optional — not yet read by any service; api/common validates session tokens via `JWT_SECRET`, not a separate hash |

### `api/observability` (Python service)

| Variable | Description |
|----------|-------------|
| `API_URL` | Base URL of the Go backend (default `http://localhost:8080`) |
| `API_TOKEN` | Optional Bearer session token presented to the Go backend |
| `API_CHECK_LIMIT` | Max recent checks to request per monitor (default 50) |
| `MONGO_URI` / `MONGO_DB` | MongoDB connection string and database name |
| `GROQ_API_KEY` | API key for LLM-rendered insights |

## Quick start (Docker)

```bash
cp .env.example .env
make up        # build + start mongo, api-common (:8080), api-observability (:8081), web (:3000)
make logs      # follow logs
make down      # stop
```

- API (common): http://localhost:8080 — health `/health`, readiness `/ready`
- API (observability): http://localhost:8081 — health `/health`, readiness `/ready`
- Web: http://localhost:3000

## Running natively (without Docker)

```bash
# Go backend — listens on :8080 (override with PORT)
cd api/common && cp .env.example .env && go run ./cmd/server

# Python observability service
cd api/observability && cp .env.example .env \
  && pip install -r requirements.txt \
  && uvicorn app.main:app --reload

# Web (dashboard + status pages)
cd web && npm install && npm run dev
```
