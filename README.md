# Upstat

Open-source uptime and status monitoring — schedule health checks against your
services, record incidents, expose status pages, and surface ML-powered
reliability insights.

## Overview

Upstat is a monorepo containing the clients, backend services, deployment
configuration, and documentation for the platform. A Go backend owns monitor
state and check execution, a Python service adds analytics and anomaly
detection, and a Next.js frontend talks to the backend over gRPC-Web through an
Envoy proxy. For a deeper description of the components and how they fit
together, see [docs/overview.md](docs/overview.md).

## Architecture

```
client                     proxy               server                    data
──────                     ─────               ──────                    ────
web dashboard   ─gRPC-Web─▶ Envoy   ──gRPC──▶  common api (Go)   ──────▶  MongoDB
(Next.js)                                      · monitor worker           ▲
                                               · checks / incidents       │
                                               · MonitorService (gRPC)     │
                                                                           │
                                       gRPC     observability (Python) ────┘
                                    GetRecentChecks · ML anomaly detection
                                                     · insight generation
```

- The browser speaks **gRPC-Web**; **Envoy** translates it to native **gRPC**
  for the Go backend and applies CORS.
- The **observability** service is a gRPC client of the Go backend: it pulls
  recent checks, runs anomaly detection / insight generation, and persists the
  results.

### Tech stack

| Layer          | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Backend API    | Go 1.25, gRPC, MongoDB (`api/common`)                  |
| Observability  | Python, FastAPI, scikit-learn, gRPC (`api/observability`) |
| Web            | Next.js, React, TypeScript, gRPC-Web                   |
| Proxy          | Envoy (gRPC-Web → gRPC)                                 |
| Mobile         | Flutter (placeholder)                                  |
| Infrastructure | Docker, Helm, Terraform                                |

## Repository structure

```
api/
  common/          Go service — gRPC backend: monitors, checks, incidents, users
  observability/   Python service — reliability analytics, ML anomaly detection, insights
web/               Next.js dashboard + status pages (gRPC-Web client)
mobile/
  flutter/         Flutter app (placeholder)
  android/         Native Android (placeholder)
  ios/             Native iOS (placeholder)
deploy/
  docker/          Container/compose configuration
  helm/            Helm chart (deploys all services, including Envoy, to Kubernetes)
  terraform/       Infrastructure as code
docs/              Project documentation
scripts/           Developer and CI helper scripts
```

Additional services follow the same convention: `api/common` is the shared Go
backend, and every other service lives under `api/<service-name>` named by its
function (never by its language).

## Getting started

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose (recommended path)
- For native development: [Go](https://go.dev/) 1.25+, [Node.js](https://nodejs.org/)
  (see `web/.nvmrc`), Python 3.11+, and Envoy (for gRPC-Web)

### Quick start

```bash
cp .env.example .env
make up      # build + start mongo, api-common (:8080), api-observability (:8081), envoy (:8082), web (:3000)
make logs    # follow logs
make down    # stop
```

Configuration is provided at runtime via environment variables (for example
`MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and the inter-service gRPC auth
token). See [docs/setup.md](docs/setup.md) for details; `make help` lists all
targets. Never commit credentials or bake them into an image.

## Documentation
- [Hosted docs](https://cuesoft.gitbook.io/upstat) — the full documentation site (auto-synced from `docs/`)

- [Project overview](docs/overview.md) — architecture and components
- [Local setup](docs/setup.md) — development environment and per-service run commands

## Contributing

Contributions are welcome. Please read the [Contributing guide](CONTRIBUTING.md)
and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening a PR.

## Security

Please report vulnerabilities privately — see our [Security policy](SECURITY.md).

## License

See [LICENSE](LICENSE).
