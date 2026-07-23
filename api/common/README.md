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

gRPC-Web browsers reach this service through Envoy (`:8082` in compose).
Regenerate stubs with the `protoc` command in [docs/grpc-api.md](docs/grpc-api.md).

## Test

```bash
go test ./...
```
