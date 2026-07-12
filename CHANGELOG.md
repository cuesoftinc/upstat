# Changelog

All notable changes to Upstat are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Standardized repository structure and shared CueLABS community-health files, a
  scoped Dependabot config, `.editorconfig`, root `Makefile`, `scripts/`, and
  `docs/overview.md` + `docs/setup.md`.

### Changed
- Renamed the Python service `api/reliability-service` → `api/observability`.
- Folded the standalone `deploy/envoy` config into the `deploy/helm` chart.
- Aligned `.gitignore`, `.editorconfig`, and `.dockerignore` to the shared
  standard; renamed `CHANGELOG` → `CHANGELOG.md`.

### Removed
- Misplaced GitHub Actions workflow files, a committed 24 MB build binary, and a
  build-error log.

### Security
- Bumped `golang.org/x/net` and `golang.org/x/crypto`; sanitized ML model file
  paths (path-injection); dismissed non-exploitable advisories in the retained
  `web/.deprecated` code.
