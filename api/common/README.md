# Upstat API (`api/common`)

Go core service: gRPC (users, monitors, status pages) and HTTP `/health` +
`/ready`, multiplexed on one port via h2c. Runs the monitor-check worker and
talks to MongoDB; consumes ML insights from `api/observability` over gRPC.

## Layout

```
cmd/server            entrypoint — slog JSON, graceful shutdown (HTTP + gRPC)
cmd/make_service_token  mints service-to-service JWTs
internal/config       env + Mongo client      internal/service   gRPC servers + worker
internal/repository   Mongo repositories      internal/model     models
internal/util         JWT, interceptor        internal/proto     generated stubs (+ .proto sources)
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

Regenerate stubs with the `protoc` command in [docs/grpc-api.md](docs/grpc-api.md).

## Test

```bash
go test ./...
```
