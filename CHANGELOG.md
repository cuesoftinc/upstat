# Changelog

All notable changes to Upstat are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Production service bootstrap: `/health` + `/ready`, structured `slog` logging,
  and signal-cancelled graceful shutdown (Go); FastAPI `lifespan` (observability).
- Merged the `web/.deprecated` dashboard into the main app: home at `/`, product
  dashboard at `/dashboard/*`, plus `/login` and `/signup`.
- Local Docker stack: root `docker-compose.yml` (mongo, api-common:8080,
  api-observability:8081, web:3000) and `.env.example`.
- Standardized repository structure and shared CueLABS community-health files, a
  scoped Dependabot config, `.editorconfig`, root `Makefile`, `scripts/`, and
  `docs/overview.md` + `docs/setup.md`.

### Changed
- Migrated `api/common` to `cmd/server` + `internal/` (singular packages,
  `snake_case.go`); `api/observability` to singular folders + `lifespan`.
- Standardized web naming (kebab-case folders + modules, PascalCase components).
- Aligned README + docs (overview, setup) to the shared CueLABS section
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
