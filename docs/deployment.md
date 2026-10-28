# Deployment — Cloud Contract

> Implements decision X-3. Cloud deploys follow proven
> patterns (workflows verified 2026-07-16); provisioning goes through the
> **IaC stack** (Pulumi) — never ad-hoc gcloud. Self-hosting via
> `deploy/` (compose/helm/terraform) is unchanged and shares only images.

## 1. Topology

| Surface | Runs on | Provisioned by |
| --- | --- | --- |
| `api/common` (Go, HTTP/h2c) | Cloud Run `upstat-api-common` (HTTP/2 enabled), **min instances 0**; checks run when Cloud Scheduler calls `POST /internal/jobs/run-checks` every minute (flows/monitor.md §3) | IaC stack |
| `api/observability` (Python) | Cloud Run `upstat-api-observability`, HTTP only, min instances 0; callable only by `upstat-common` | IaC stack |
| Cloud Scheduler `upstat-run-checks` | Every minute, OIDC token to the common service; created paused until the PR that adds the endpoint deploys | IaC stack |
| `web` (Next.js) | **Firebase App Hosting** backend `upstat-website` (upstat.cuesoft.io); proxies `/api/v1/*` to the common service | App Hosting backend |

Ingest, query, alerting and probes are Planned (system-design.md §10.1) and
are not provisioned.

### Staging estate

| Item | Value |
| --- | --- |
| GCP project / region | `sandbox-e306a` / `us-central1` |
| Runtime accounts | `upstat-common`, `upstat-observability` |
| URLs | `https://<service>-805800737799.us-central1.run.app` |
| Stores | Firestore sandbox (Mongo-compatible); Aiven Postgres `sandbox-db` (database and user `upstat`); Aiven Valkey `sandbox-cache` (user `upstat`, keys `upstat:*`) |
| ClickHouse | ClickHouse Cloud account, outside the GCP IaC (Planned) |
| Secrets | Doppler project `upstat`, config `stg` |
| GitHub environment `Sandbox` variables | `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT` |

## 2. Provisioning (IaC)

- **Pulumi, bun runtime**; state in a GCS state bucket;
  per-product stack (`Pulumi.<product>.yaml`).
- Cloud Run services instantiate the shared Cloud Run service
  module; the GitHub→GCP deploy identity uses **Workload Identity
  Federation** — no service-account keys in GitHub.
- Secrets/env flow from **Doppler** (the product's Doppler `stg` config) into
  Cloud Run env; the repo's `.env.example` files document the variable
  names, Doppler owns values.

## 3. CI/CD (GitHub Actions)

| Workflow | Trigger | Does |
| --- | --- | --- |
| `build-and-test.yml` | PRs **and** push to `main` | build + tests per service; **no deploy, no image push** (`release.yml` deploys) |
| `release.yml` | **push to `main` touching `api/**`** | buildx (GHA cache) → push `cuesoft/upstat-api-{common,observability}` (tags: sha, `latest`) → Cloud Run services updated **by image digest** via WIF in the `Sandbox` environment → fails unless every newest revision is Ready and common answers `/ready`. The website is not in it: App Hosting rolls out from `main` |

**Gating (X-6, revised 2026-10-27):** `stg` (sandbox) is the only
environment. A merge to `main` that touches `api/**` deploys the API services
to the sandbox; review and merge rights on `main` are the gate. The deploy job
runs in the `Sandbox` environment, which holds the WIF variables. No version
tags: images carry the commit sha and `latest`.

Two hard-won rules, non-negotiable:

1. **Deploy by digest, never by tag** — Cloud Run pulls Docker Hub images
   through the `mirror.gcr.io` cache, which has served stale manifests for
   tags; the staging workflow threads `steps.build.outputs.digest` into the
   deploy step.
2. **WIF only** (`google-github-actions/auth@v3` with
   `workload_identity_provider` + `service_account`) — no JSON keys.

The single protected GitHub environment is **`Sandbox`** (X-6): required
reviewers and the four `GCP_*` variables above. No other deploy environments
exist.

## 4. Runtime contract (Cloud Run) **[Decided defaults]**

| Service | CPU / mem | Concurrency | Min–max instances | Timeout |
| --- | --- | --- | --- | --- |
| api/common | 1 vCPU / 512 MiB | 80 | 0–5 | 60 s |
| api/observability | 1 vCPU / 1 GiB | 10 | 0–3 | 120 s |

- Run-checks guard: `common` verifies the scheduler's Google OIDC token.
  `SCHEDULER_AUDIENCE` must equal the token audience and
  `SCHEDULER_INVOKER_EMAIL` the scheduler service account (verified email);
  either unset returns 503, a bad token 401, a wrong email 403.
- Set `WORKER_ENABLED=false` on Cloud Run: an idle instance does not run the
  in-process worker loop, so Cloud Scheduler drives every pass.
- Domains: `upstat.cuesoft.io` → web; the APIs are reached through the web
  proxy.
- Rollback: redeploy the previous image digest (recorded in the release run).
- Web env: `NEXT_PUBLIC_*` flows Doppler → `apphosting.yaml` at rollout.

## 5. Not in this phase

Writing these workflows + the Pulumi stack is **implementation work**, out of
scope for the docs phase — this document is the contract they'll be built
against. Docker Hub repos already exist for every image name above.
