# Upstat API (`api/common`)

Go core service: HTTP/JSON (auth, monitors, status pages, `/health` +
`/ready`) on one port (8080), with h2c so Cloud Run HTTP/2 works. Runs the
monitor-check worker and talks to MongoDB. `api/observability` reads monitor
checks from it over HTTP.

## Layout

```
cmd/server            entrypoint — slog JSON, graceful shutdown
cmd/make_service_token  mints service-to-service JWTs
internal/config       env + Mongo client      internal/service   check worker
internal/repository   Mongo repositories      internal/model     models
internal/util         JWT, session middleware  internal/handler   HTTP handlers
```

## Run

From the repo root (recommended): `cp .env.example .env && make up` → :8080.
Natively: `go run ./cmd/server` (see `.env.example` here for required vars).

The web reaches this service by proxying `/api/v1/*`.

`POST /internal/jobs/run-checks` runs one pass of due checks (the Cloud Scheduler
job `upstat-run-checks` calls it every minute). It needs a Google OIDC bearer
token: `SCHEDULER_AUDIENCE` must equal the token audience and
`SCHEDULER_INVOKER_EMAIL` the verified `email` claim. Either unset returns 503,
a bad token 401, a wrong email 403. Other job names return 404. Set
`WORKER_ENABLED=false` on Cloud Run; it defaults to on locally.

## Test

```bash
go test ./...
```
