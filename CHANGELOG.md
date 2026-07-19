# Changelog

All notable changes to Upstat are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Google sign-in session now works end-to-end: `ProtectedRoute`/logout/header
  read the `upstat_token`/`upstat_user` cookies the login flow sets (they read
  a `localStorage` key nothing wrote); route protection enforced dashboard-wide
  via the layout.
- Observability gRPC error paths used `grpc.aio.StatusCode` (AttributeError at
  runtime); signup page wires results to state instead of console logs.
- Helm chart deploys the actual stack (it shipped a foreign demo image and
  deployed none of Upstat's services); terraform is cluster-agnostic
  (kubeconfig-based) instead of GKE-specific.
- api-common was never given `MONGO_DB` by compose/helm/env examples, so every
  Mongo call targeted an empty database name; Envoy's upstream host is now the
  `api-common` service name (the old `upstat_backend` alias only existed on the
  compose network, breaking gRPC-Web on Kubernetes); doc run commands corrected
  (`go run ./cmd/server`, `uvicorn app.main:app`).

### Security
- Unauthenticated `GetUser` without a password no longer returns any user's
  profile by email (enumeration/PII); JWT signing refuses an empty secret and
  propagates errors; Envoy admin bound to loopback and CORS narrowed from `*`.

### Changed
- Canonical Go module path `github.com/cuesoftinc/upstat/api/common`; dotted Go
  filenames renamed to snake_case; flagged log calls moved to slog; observability
  entrypoint moved to `app/main.py`; per-service README/.gitignore/.env.example
  standardized; Envoy image pinned.
- Architecture doc paths (incl. mermaid click links) updated for the
  `cmd/server` + `internal/` and `app/` restructures; the gRPC API doc now
  covers `GetRecentChecks` and the companion `InsightService` proto and drops
  removed SMTP config; Helm values document the external MongoDB requirement
  and gained an optional `envFrom` secret hook; `calendar.type.ts` renamed to
  `calendar.types.ts` to match the `.types.ts` convention.

### Removed
- 24MB committed build binary, trained `.pkl` artifacts (now git-ignored), junk
  placeholder files, the orphaned legacy dashboard/login/signup component trees,
  dead Python modules (`insight_sender`, `anomaly_detector`, `isolation_forest`,
  `grpc_main`, `incident`), dead email helpers + their SMTP plumbing, and the
  unused axios dependency.

### Added
- Production service bootstrap: `/health` + `/ready`, structured `slog` logging,
  and signal-cancelled graceful shutdown (Go); FastAPI `lifespan` (observability).
- Merged the `web/.deprecated` dashboard into the main app: home at `/`, product
  dashboard at `/dashboard/*`, plus `/login` and `/signup`.
- Local Docker stack: root `docker-compose.yml` (mongo, api-common:8080,
  api-observability:8081, envoy:8082, web:3000) and `.env.example`.
- Standardized repository structure and shared CueLABS™ community-health files, a
  scoped Dependabot config, `.editorconfig`, root `Makefile`, `scripts/`, and
  `docs/overview.md` + `docs/setup.md`.

### Changed
- Migrated `api/common` to `cmd/server` + `internal/` (singular packages,
  `snake_case.go`); `api/observability` to singular folders + `lifespan`.
- Standardized web naming (kebab-case folders + modules, PascalCase components).
- Aligned README + docs (overview, setup) to the shared CueLABS™ section
  structure; run commands use `make up` / `go run ./cmd/server`.
- Renamed the Python service `api/reliability-service` → `api/observability`.
- Folded the standalone `deploy/envoy` config into the `deploy/helm` chart.
- Aligned `.gitignore`, `.editorconfig`, and `.dockerignore` to the shared
  standard; renamed `CHANGELOG` → `CHANGELOG.md`.

### Removed
- The superseded `web/.deprecated` tree, dead `LayoutShell`, and a stray
  `k8s/deployment.yaml`.
- Misplaced GitHub Actions workflow files, a committed 24 MB build binary, and a
  build-error log.

### Security
- Bumped `golang.org/x/net` and `golang.org/x/crypto`; sanitized ML model file
  paths (path-injection); dismissed non-exploitable advisories in the retained
  `web/.deprecated` code.
