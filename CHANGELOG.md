# Changelog

All notable changes to Upstat are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Web app manifest at `/manifest.webmanifest`: install identity — product
  name, theme colors, and icons (#206).
- Settings goes route-backed tabs: General | Members | Keys & properties |
  Integrations | Data & privacy | Appearance | Usage — seven deep-linkable
  tabs (#188).
- Self-host install snippet goes tabbed: Docker Compose and Helm (#184).
- SEO plumbing: sitemap, `robots.txt`, canonical URLs, an Open Graph card, and
  a real brand favicon in place of the placeholder (#195).

- Full observability web application (monitors, incidents, logs, metrics, RUM,
  and public status pages) built from the shared component registry over a
  mock CRUD API, with multi-organization onboarding.
- Synthetics builder (HTTP, multi-step, and browser checks) with a
  step-by-step run view; a status-page builder; log pattern grouping; usage
  metering; and an RUM session drill-down.
- Portable dashboards (export/import as versioned JSON), correlated logs
  inside the trace/span view, "declare incident" directly from an alert, and
  a mobile navigation-rail drawer.
- A Features pillar dropdown in the marketing nav, a colorblind-safe chart
  mode with accompanying data tables, virtualized log streams, postmortem
  authoring, and grouped monitor views.
- Interactive Scalar API reference at `/docs/api`, rendered live from the
  repository's OpenAPI spec.
- Tri-state theme control (light / dark / system).

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

- The command palette and the keyboard-shortcut overlay ride the same dialog
  primitive as the rest of the overlay set — focus is trapped while they are
  open; dismissal and focus-restore behavior are unchanged (#206).
- The demo chart's crosshair tooltip follows the hero loop without shifting
  layout — home CLS lands at ~0 (#206).
- The skip-to-content link converges on the fleet-canonical implementation
  (#206).
- `/docs/api`'s Scalar reference now loads on user intent instead of shipping
  eagerly with the route (#198).
- Tree-shape parity: env reads route through typed `config/env.ts`
  accessors, the gRPC client rehomes under `models/repositories/`, and the
  root layout's fallback description matches the shipped OG tagline (#199).
- Dashboard CLS (NavRail width settling before first paint, reserved widget
  frame heights, a stable `IncidentBanner` slot) and home TBT (below-the-fold
  demo panels mount on intersection) both land inside budget (#201).

- Dead-code and env-plumbing cleanup: removed dead exports, scaffold assets,
  an unused dependency, and the dead `NEXT_PUBLIC_BASE_URL` env plumbing
  (docs now name the real var); piped Playwright's `webServer` output so CI
  server deaths are diagnosable (#190, #191, #193).

- Marketing content pass: the nav/footer "Dashboards" slot became "Platform"
  (linking to the pillar grid), duplicate community CTAs were consolidated to
  three canonical spots, and `/login` was retired in favor of `/signin`.
- Mobile-responsive pass across the dashboard, status pages, and home: no
  document-level side-scroll at 390px, a collapsed top-bar utility cluster,
  and single-column stacking for widget/stat grids.
- Floating layers (popovers, dropdowns, menus, notification/time-picker
  panels) never overflow the viewport.
- Demo-realism pass: deploy-correlated telemetry, a coherent activity feed,
  and accessible live-region announcements.

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

- The legacy quarantine tree (pre-registry login/signup, dashboard, and
  component trees).

- 24MB committed build binary, trained `.pkl` artifacts (now git-ignored), junk
  placeholder files, the orphaned legacy dashboard/login/signup component trees,
  dead Python modules (`insight_sender`, `anomaly_detector`, `isolation_forest`,
  `grpc_main`, `incident`), dead email helpers + their SMTP plumbing, and the
  unused axios dependency.

- The superseded `web/.deprecated` tree, dead `LayoutShell`, and a stray
  `k8s/deployment.yaml`.
- Misplaced GitHub Actions workflow files, a committed 24 MB build binary, and a
  build-error log.

### Fixed

- Accessibility closeout: footer links meet the 24px target-size minimum,
  the cloud-vs-self-host comparison table names its feature column for
  assistive tech, a skip-to-content link fronts the app shell, and the
  command palette opens on ⌘K as well as "/" (#204).
- Contrast-token canon: AA-compliant `-text` variants for the tinted-chip
  recipe, plus a new `on-crit` token (#196).
- Signin gains the sibling-parity legal consent line (#200).

- Figma↔code convergence pass: home content, charts, pills sweep, `NavRail`,
  brand mark, banner, `FacetGroup` header, landing font-smoothing/type lock,
  `TimePicker` panel anatomy, monitors editor panel whitespace, the `?run=`
  lock, and `IncidentBanner` chrome-strip placement (#180, #181, #182, #185,
  #186, #192).
- Self-host checklist now names the shipping database (MongoDB) instead of
  the earlier target (#189).
- Accessibility: pinch-zoom restored, nav-rail links corrected, and command
  palette dismissal/focus restore fixed (#194).

- An unset theme preference now boots the design default instead of forcing
  a theme choice; the `/docs/api` header now coexists cleanly with the rest
  of the app shell.
- System QA pass: usability, accuracy, and interaction fixes across the app.

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

- Bumped `golang.org/x/net` and `golang.org/x/crypto`; sanitized ML model file
  paths (path-injection); dismissed non-exploitable advisories in the retained
  `web/.deprecated` code.
