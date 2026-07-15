# Upstat — Roadmap

> Ordered plan from the gap analysis (api.md §4). Upstat's monitoring core
> (M1) works; the phases apply the landing design, ship the events layer that
> two sibling roadmaps wait on, make dashboards honest, and add alerting.

## Phase 0 — Landing + privacy (public face)

| Item | Requirement | Notes |
| --- | --- | --- |
| Apply the Figma landing design (hero + dashboard preview, features grid, example cards, CTAs) | UPS-001, UPS-004, PRD §6 | Design exists (single desktop frame; run a naming/hygiene pass + responsive interpretation) |
| Example analytics/uptime cards with demo data | UPS-004 | Reuse dashboard components |
| Privacy disclosure page | UPS-005, D3 | Must already describe the *intended* cookieless analytics posture so ANA-001 ships inside a published promise |
| Public status page for upstat.cuesoft.io itself | PRD §5 reliability showcase | `GetStatusPage` already exists — configure + link it |

**Exit criteria:** a visitor understands the product in one page; Upstat's own
status is public; privacy stance published.

## Phase 1 — Events layer (M3 first: unblock the ecosystem)

> Highest cross-repo leverage: apparule Phase 0 and expendit Phase 3 are
> blocked on this (their "D2").

| Item | Requirement |
| --- | --- |
| Property + write-only key model, origin allowlists | ANA-001 |
| `POST /v1/events` (schema-validated, rate-limited, batch) | ANA-001 / ECO-TRACK |
| `upstat.js` tracking script (cookieless, SPA-aware) | ANA-001 |
| Rollup worker in api/observability (hour/day, approx uniques) | ANA-001 |
| `GET /v1/stats` | ANA-002 dependency |
| TTL retention indexes + documented policy | ANA-003 |
| Register sibling consumers (apparule, expendit event names) | ECO-TRACK |

**Exit criteria:** sibling products' events flow end-to-end and appear in
stats queries; retention enforced by TTL; D2 declared **delivered** to the
other repos.

## Phase 2 — Honest dashboards + alerting

| Item | Requirement |
| --- | --- |
| Traffic dashboard reads `/v1/stats` (mock routes deleted) | ANA-002 |
| Bounce/SEO/page-load pages: keep only what real data supports; park the rest | ANA-002, PRD §5 restraint |
| `AlertService` (channels: email + webhook; rules: down/recovered, cooldown) | MON-001 |
| Worker dispatch on state transitions | MON-001 |
| Email provider decision + verified-channel flow | prd.md §8.2 |
| User-facing setup docs: create monitor, install script, configure alerts, retention | UPS-003 |

**Exit criteria:** no mock data anywhere; a down monitor emails its owner
within one check interval; UPS-003 docs published.

## Phase 3 — Ecosystem identity + managed reporting

| Item | Requirement | Notes |
| --- | --- | --- |
| `account.cuesoft.io` sign-in + local-user linking | ECO-AUTH | Blocked by D1 |
| Managed-client monitoring reports (export/scheduled) for `clients.cuesoft.io` | ECO-SUPPORT | Shape depends on prd.md §8.4 |
| Cross-product analytics views for internal teams | M3 maturity | e.g. ecosystem-wide event dashboard |

## Dependencies

| ID | Dependency | Direction | Blocks |
| --- | --- | --- | --- |
| D1 | `account.cuesoft.io` contract | consumed | Phase 3 identity |
| **D2** | Event-ingestion API | **provided by this repo (Phase 1)** | apparule P0 analytics, expendit P3 analytics |
| D3 | Upstat clause on privacy.cuesoft.io | consumed | Phase 0 privacy copy |
| D4 | Email provider decision | internal | Phase 2 email alerts (webhooks unaffected) |

## Sequencing rationale

Phase 0 is pure web + configuration. Phase 1 jumps ahead of alerting because
two other product roadmaps are blocked on it and it's additive (new endpoints,
no changes to the working monitor path). Phase 2 then makes the product honest
(real data) and complete (alerts — the biggest monitoring-product gap). Phase 3
waits on external contracts.

---

## Revision — observability platform expansion (2026-07-16)

Supersedes the §5-restraint framing above (kept for audit). Phases 0–2 stand
— they build the landing, the events layer (now the RUM foundation), honest
dashboards, and alerting channels. The expansion then proceeds by pillar,
each gated on the storage decision **R2 (ClickHouse — ratify)**:

- **Phase 3 — Ingestion + Metrics**: OTLP gateway, ingest keys/quotas,
  telemetry store, metrics explorer, dashboard grid v1 (OBS-001/002/005),
  monitor engine generalized to metric thresholds.
- **Phase 4 — Logs**: log intake, explorer + live tail + facets, log
  monitors (OBS-003).
- **Phase 5 — APM**: trace intake, service pages, waterfall, service map,
  latency/error monitors (OBS-004, OBS-010 catalog alongside).
- **Phase 6 — RUM maturation**: browser SDK grows vitals + error tracking on
  the events layer (OBS-007); analytics pages complete.
- **Phase 7 — SRE layer**: incident management v2, SLOs + burn monitors,
  postmortems (OBS-008/009); mobile on-call companion enters design.
- Ongoing: synthetics beyond HTTP, log patterns/archives, usage metering
  (OBS-011/012).

Sequencing rationale: metrics before logs before traces matches ingestion
complexity and monitor value; RUM rides the already-shipped events layer;
the SRE layer needs signals to exist first. Every pillar ships explorer +
retention + monitors together (architecture honesty stance) — feature flags
keep partial pillars invisible.
