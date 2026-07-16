# Upstat — Decision Sheet

> Ratify by checking a box; each decision flips its **[Proposed]** tags to
> **[Decided]** and unblocks the listed phases. Status: ☐ open · ☑ ratified.

## U-1 · Unified telemetry store (R2) — gates Phases 3–7 (every pillar)

| Option | For | Against |
| --- | --- | --- |
| **(a) ClickHouse — one columnar store for metrics + logs + traces; Mongo stays control-plane** ⭐ | The Signoz/HyperDX-proven pattern; one system to operate; excellent compression + TTLs; self-host = one more container | New operational skill to build |
| (b) VictoriaMetrics + OpenSearch split | Best-of-breed per signal | Two stateful systems to run + query-layer complexity |
| (c) Stretch MongoDB | No new infra | Falls over on high-cardinality timeseries + log search; would poison every pillar |

**Also ratify with it:** self-host compose gains a `clickhouse` service; helm
documents external-or-StatefulSet options (same stance as Mongo today).

☐ Ratified: option ___

## U-2 · Browser event auth (ANA-001) — gates Phase 1 (events layer, "D2")

**Recommendation ⭐:** public **write-only property key** + origin allowlist +
per-key rate limits + closed event/dims schema; `visitor_hash` computed
server-side. This is the standard cookieless-analytics posture
(Plausible/Fathom-class). No cookies, no raw IPs at rest.

☐ Ratified

## U-3 · Cookieless visitor model — privacy-defining, published in UPS-005

**Recommendation ⭐:** `visitor_hash = hash(daily_salt, property, ip, UA)`;
salt rotates daily; raw IP never stored; uniques are approximate and
documented as such; no cross-property joins, ever.

☐ Ratified

## U-4 · Alert channels & email provider (MON-001) — gates Phase 2

**Recommendation ⭐:** **webhooks first** (provider-independent, ships
immediately), **email via Resend** second (developer-grade DX, sane pricing;
SES is the cost-optimization escape hatch later); Slack via webhook URL
initially, native app later.

☐ Ratified: email provider ___

## U-5 · Protocol split — gates all new surfaces

**Recommendation ⭐:** existing user/monitor control plane stays **gRPC**
(works, typed, Envoy already wired); every new surface is **HTTP/JSON**
(events, stats, query, OTLP/HTTP alongside OTLP/gRPC, dashboards, monitors-v2,
incidents, SLOs). Browsers and sibling products never need proto toolchains.

☐ Ratified

## U-6 · Retention defaults per signal — published per UPS-003

**Recommendation ⭐:** raw events 90d · hourly rollups 90d · daily rollups
13mo · check results 90d · incidents indefinite · metrics 13mo
(rollup-thinned) · logs 15d hot (archive later) · traces 7d sampled.

☐ Ratified (or adjust: ___)

## U-7 · Brand & theme (sampled 2026-07-16)

**Recommendation ⭐:** brand **#00E09E** + `brand-deep` **#00A991** (sampled
from the existing landing, now in `upstat/tokens`); dashboards **default
dark**, light supported; `ok` green kept visually distinct from brand teal.
Effectively already true — ratifying makes it official.

☐ Ratified

## Cross-cutting

- **X-1 account.cuesoft.io**: OIDC target; local JWT interim. ☐
- **X-2 Docs platform**: GitBook space per product, Git-synced; Scalar API
  refs. ☐
