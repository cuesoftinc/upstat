# Deployment: Cloud Contract

> Implements decisions X-3 and X-6, with the units from S-1. Cloud deploys
> follow proven patterns (workflows verified 2026-07-16); provisioning goes
> through the **infrastructure-as-code stack**, never ad-hoc gcloud.
> Self-hosting via `deploy/` (compose, Helm, Terraform) shares only the
> images (§6).

## 1. Topology

| Surface | Runs on | Called by |
| --- | --- | --- |
| `api/common` (Go, HTTP/h2c) | Cloud Run `upstat-api-common` (HTTP/2 enabled). Runs the Postgres and ClickHouse migrations on start, owns the outbox and consumes `cuelabs.results` | web proxy, Cloud Scheduler |
| `api/query` (Go, ClickHouse reads) | Cloud Run `upstat-api-query`. Public `/v1/*` reads for signed-in users, `/internal/v1/*` for services | web proxy, common, analytics |
| `api/observability` (NestJS ingest gateway) | Cloud Run `upstat-api-observability` (OTLP/HTTP and `/v1/events`) and `upstat-api-observability-grpc` (OTLP/gRPC), one image | public (ingest keys) |
| `api/analytics` (Python: evaluator, notifier, rules, SLOs, insights) | Cloud Run `upstat-api-analytics`, authenticated only. Consumes `cuelabs.requests` and `cuelabs.results` | Cloud Scheduler, wake calls |
| `functions/probe` (Python, pycurl) | Cloud Run functions `upstat-probe-us-central1` and `upstat-probe-us-east4`, private (S-5) | common |
| OTel Collector (stock `otel/opentelemetry-collector-contrib:0.130.0`) | Cloud Run `upstat-otel-collector`, private, config from `deploy/docker/otel-collector.yaml` | observability, common |
| `web` (Next.js) | **Firebase App Hosting** backend `upstat-website` (upstat.cuesoft.io). `/api/v1/*` proxies telemetry reads to query and everything else to common | browsers |

Data path: OTLP and events go gateway → collector → ClickHouse (S-6).
Check results also reach ClickHouse through the collector, sent by common.
Kafka carries control events only (S-2), and config reaches the services as
snapshot objects in the bucket plus `upstat.config.changed` (S-8).

### Cloud Scheduler jobs

Each job sends a Google OIDC token, checked against `SCHEDULER_AUDIENCE` and
`SCHEDULER_INVOKER_EMAIL` on the receiving service.

| Job | Target | Schedule |
| --- | --- | --- |
| `upstat-run-checks` | common `POST /internal/jobs/run-checks` | every minute |
| `upstat-prune` | common `POST /internal/jobs/prune` | daily |

### Scale to zero (S-14)

Every service runs at min 0 with **request-based CPU**, as the sibling
expenses product does: nothing is billed while nobody uses Upstat. An instance has CPU
only while it serves a request, so work that must finish happens inside
one:

- A write to common publishes its outbox rows before it answers.
- Each run-checks pass ends with `POST /internal/settle` on analytics
  (`WAKE_ANALYTICS_URL`): analytics evaluates rules, SLOs and nodata timers,
  starts the hourly insight pass when due, and answers once its lanes are
  caught up. common then waits until it has handled the transitions that
  came back (incidents). Alerts never depend on background CPU.
- query and the gateway reread their config snapshots when a lookup misses
  (a just-created org or key), at most every 10 s and 30 s per instance.
- Other publishes still wake consumers with `GET /health` (S-10); anything
  a wake leaves unhandled is handled by the next pass, within a minute.

### Service-to-service auth

- On Cloud Run, internal calls carry Google ID tokens. query checks
  `INTERNAL_AUDIENCE` and `INTERNAL_INVOKERS` (the common and analytics
  service accounts). Off Cloud Run, a shared `INTERNAL_TOKEN` does the same
  job.
- The probe functions and the collector have private ingress. Only common
  holds invoker on the probes; common and observability hold invoker on the
  collector.
- The gateway authenticates every request with an ingest key (ingestion
  token for OTLP, property key for events) from the config snapshot.

### Staging estate

| Item | Value |
| --- | --- |
| GCP project / region | `<project-id>` / `us-central1` (probe also in `us-east4`) |
| Runtime accounts | `upstat-common`, `upstat-query`, `upstat-observability`, `upstat-analytics`, `upstat-probe` (no roles), `upstat-otel-collector` |
| URLs | `https://<service>-<project-number>.us-central1.run.app` |
| Postgres | managed Postgres, database `upstat`; common connects as the non-superuser app role so row-level security applies (S-9) |
| Valkey | managed Valkey, user `upstat`, keys `upstat:*` (gateway quotas, rate limits) |
| Kafka | the shared Kafka service; Upstat uses the existing `cuelabs.requests` and `cuelabs.results` lanes and never creates topics (X-11) |
| Bucket | GCS bucket with prefix `upstat/` for config snapshots, claim-check payloads and postmortems |
| ClickHouse | **Open question for the boss (S-4)**, see §5 |
| Secrets | your secrets manager (`stg` config) |
| GitHub environment `Sandbox` variables | `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `PROBE_SERVICE_ACCOUNT` |

## 2. Provisioning (infrastructure-as-code)

- One infrastructure-as-code stack per product; state lives in a remote
  state bucket.
- Cloud Run services instantiate the shared Cloud Run service module; the
  GitHub→GCP deploy identity uses **Workload Identity Federation**, no
  service-account keys in GitHub.
- The stack creates every service, both probe function shells, the four
  scheduler jobs, the runtime accounts, the invoker grants in §1 and the
  bucket. `release.yml` only points existing resources at new digests and
  deploys the probe's source.
- Secrets and env flow from **your secrets manager** (the product's `stg`
  config) into Cloud Run env. The `.env.example` files and
  system-design.md §10.3 list the variable names; the secrets manager owns
  the values.

First rollout order: bucket and stores, then the collector, then common
(it runs the migrations), then query, observability and analytics, then the
probes, then the scheduler jobs (created paused, resumed once common and
analytics answer `/ready`).

## 3. CI/CD (GitHub Actions)

| Workflow | Trigger | Does |
| --- | --- | --- |
| `build-and-test.yml` | PRs **and** push to `main` | build and tests per service; **no deploy, no image push** |
| `release.yml` | push to `main` touching `api/**` or `functions/**` | buildx (GHA cache) → push `cuesoft/upstat-api-{common,query,observability,analytics}` (tags: sha, `latest`) → updates the five Cloud Run services **by image digest** via WIF in the `Sandbox` environment, common first → fails unless every newest revision is Ready and common answers `/ready` → deploys the probe function source to both regions. The website is not in it: App Hosting rolls out from `main` |

**Gating (X-6, revised 2026-10-27):** `stg` (sandbox) is the only
environment. A merge to `main` that touches `api/**` or `functions/**`
deploys to the sandbox; review and merge rights on `main` are the gate. The
deploy jobs run in the `Sandbox` environment, which holds the WIF variables.
No version tags: images carry the commit sha and `latest`.

Two hard-won rules, non-negotiable:

1. **Deploy by digest, never by tag.** Cloud Run pulls Docker Hub images
   through the `mirror.gcr.io` cache, which has served stale manifests for
   tags; the workflow threads each build's digest into its deploy step and
   retries image pull failures (`.github/scripts/deploy-with-retry.sh`).
2. **WIF only** (`google-github-actions/auth@v3` with
   `workload_identity_provider` and `service_account`), no JSON keys.

The single protected GitHub environment is **`Sandbox`** (X-6): required
reviewers and the `GCP_*` and `PROBE_SERVICE_ACCOUNT` variables above.

## 4. Runtime contract (Cloud Run)

| Service | CPU / mem | Concurrency | Min to max instances | Timeout | CPU |
| --- | --- | --- | --- | --- | --- |
| api/common | 1 vCPU / 512 MiB | 80 | 0 to 5 | 300 s | request-based |
| api/query | 1 vCPU / 512 MiB | 80 | 0 to 5 | 60 s | request-based |
| api/observability (HTTP and gRPC) | 1 vCPU / 512 MiB | 80 | 0 to 10 | 60 s | request-based |
| api/analytics | 1 vCPU / 1 GiB | 10 | 0 to 2 | 300 s | request-based |
| otel-collector | 1 vCPU / 1 GiB | 80 | 0 to 2 | 60 s | request-based |
| probe functions | 0.5 vCPU / 512 MiB | 20 | 0 to N | 60 s | request-based |

common's sizing is the decided default. The rest are proposed starting
points to tune from the sandbox's real load. The collector exports before
it answers (no batch processor, no sending queue; ClickHouse async inserts
batch), so it scales to zero too; during a ClickHouse outage the gateway
answers 503 and senders' OTLP exporters retry.

- Set `WORKER_ENABLED=false` on common and analytics: the in-process loops
  are for compose and Helm; in cloud the scheduler and settle drive them.
- Set `WAKE_ANALYTICS_URL` on common: it turns on the settle pass.
- Cost budget: Cloud Run's monthly no-cost allowance (roughly 180,000 vCPU-seconds and 2 million
  requests a month per billing account, shared with the other products)
  covers a per-minute pass that settles in a few seconds. A pass waits for
  its slowest target, so many slow or timing-out monitors cost more.
- Leave `SELF_HOST` unset in cloud: with it off, common refuses private,
  loopback and metadata targets for monitors and webhooks. The probe
  re-checks every resolved IP regardless.
- `PROBE_URLS` on common lists both regions (`us-central1=<url>,us-east4=<url>`);
  monitors default to quorum 2 of 2 (S-5).
- Email alerts need `BREVO_API_KEY` and `FROM_EMAIL` on analytics; without
  them channel verification records "email is not configured".
- Domains: `upstat.cuesoft.io` → web; the APIs are reached through the web
  proxy. The ingest gateway gets its own public URL (or a custom domain such
  as `ingest.upstat.cuesoft.io`), since SDKs and OTel exporters call it
  directly.
- Rollback: redeploy the previous image digest (recorded in the release
  run). Migrations are forward-only, so roll back code, not schema.
- Web env: `NEXT_PUBLIC_*` flows from your secrets manager to
  `apphosting.yaml` at rollout; `API_URL` and `QUERY_URL` point the proxy at
  common and query.

## 5. Open: ClickHouse hosting (S-4)

The code, schema and compose use the open-source ClickHouse server, and
every environment only needs `CLICKHOUSE_URL` plus credentials. Where it runs
in the sandbox is the boss's call. ClickHouse Cloud and Aiven's ClickHouse
are paid, so the known options are a paid managed service or a self-run server on
a small GCE VM. Until it is decided, common, query and the collector have no
telemetry store in the cloud, so ClickHouse must be in place before the first
rollout.

Whatever hosts it needs two users: one for common's migrations
(`CLICKHOUSE_MIGRATE_USER`) and one read-only for query, plus the row
policies the migrations create (S-9).

## 6. Self-host

- **Compose** (`docker-compose.yml`): every service runs all the time
  (`WAKE_*` unset, so no settle). It runs Postgres, ClickHouse, Kafka
  (KRaft, single node, lanes created by `deploy/docker/kafka/create-topics.sh`),
  Redis, SeaweedFS (S3), the collector, the probe as a container
  (`PROBE_REGION=local`, quorum 1) and all app services. `SELF_HOST=true`
  lets self-hosters monitor their own private services, and
  `WORKER_ENABLED=true` runs checks in process. A full end-to-end smoke
  test passed on 2026-11-01.
- **Helm** (`deploy/helm`): one chart deploys every service from the same
  images; the stores are external endpoints. Pass the collector config with
  `--set-file services.otel-collector.env.OTEL_COLLECTOR_CONFIG=deploy/docker/otel-collector.yaml`.
- **Terraform** (`deploy/terraform`): the self-host module, separate from
  the cloud infrastructure-as-code stack.
