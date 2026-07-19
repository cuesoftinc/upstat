# Upstat — Pages, Screens & Features

> Component-level inventory referencing [design.md](design.md) (`MI-n`).
> The 2026-07-16 directive expands Upstat to a **full observability & SRE
> platform** (Datadog-class) — this supersedes the earlier PRD §5
> "lightweight, avoid enterprise observability" restraint, which previous
> docs treated as a guardrail. Superseded statements in prd.md/roadmap.md are
> annotated rather than rewritten (audit trail). **[Directive]**

## Part A — Public home page (upstat.cuesoft.io)

Shared CueLABS™ open-source-site pattern (Discord, GitHub, preview, **Try
Cloud** / **Self Host**) in a Datadog-style product-led execution. The
existing Figma landing (single desktop frame; pillars "Dev-first workflows",
"Works for your Business needs", "Open-source, Transparent and
community-driven") remains the visual base, extended for the new pillars.

| # | Section | Content | Interactions |
| --- | --- | --- | --- |
| A1 | Nav | logo · Features (anchors the A11 feature-highlights band, `/#features` — differentiated from Platform 2026-07-19; the pillar-map dropdown preview remains specced, unbuilt) · Platform (anchors to the A3 pillar grid) · Docs (GitBook) · GitHub star badge (neutral "Star") · ThemeToggle · Sign in text link · **Try Cloud** CTA **[Revised 2026-07-19]** | Features dropdown = mini feature map **[gap — pending adjudication vs the 4-text-links canon]** |
| A2 | Hero | H1 (from Figma pillars); dual CTA **Try Cloud** / **Self Host**; hero visual: live-looking dashboard with animated timeseries + synced crosshair demo | crosshair demo animates on an 8s loop |
| A3 | Pillar grid | 8 cards: Uptime & Synthetics · Website Analytics/RUM · Metrics · Logs · APM/Traces · Dashboards · Alerting · Incidents & SLOs | hover lifts + pillar color accent |
| A4 | Demo strip | **static demo cards** (synthetic data, U0-3) — the interactive embedded demo org is descoped to a post-Phase-3 enhancement **[Decided]** | — |
| A5 | How ingestion works | OTLP/agent diagram: your services → OTel SDK/collector → Upstat | copyable snippet tabs (Go/Python/Node/k8s) |
| A6 | Reliability showcase | Upstat's own public status page embedded (self-referential trust, PRD §5) | |
| A7 | Open-source | compose snippet, architecture diagram, GitHub/CONTRIBUTING | |
| A8 | Community | public-status card ("View live →" → https://upstat.cuesoft.io/status/upstat — the product's own status page, dogfooding B7) · roadmap · CueLABS™ **[Revised 2026-07-19]** — community-CTA placement canon: GitHub/Discord moments live in exactly three spots — the nav star badge, the A13 developers pair (#upstat-lab copy), and the footer Community column | |
| A9 | Cloud vs Self-host table | per-column CTAs · docs deep-link rows under the compose line — "Self-host guide" (→ cuesoft.gitbook.io/upstat/system/deployment) + "Query grammar" (→ cuesoft.gitbook.io/upstat/system/query-grammar); label copy with hyperlinks, no raw URL strings on canvas **[Revised 2026-07-19]** | |
| A10 | Footer | standard + privacy (UPS-005) | |

Iteration 1 additions **[Directive 2026-07-18]** — existing rows keep their
IDs (cross-referenced elsewhere); each new row notes where it slots into the
page order.

| # | Section | Content | Interactions |
| --- | --- | --- | --- |
| A11 | Feature deep-dives | benefit-led deep-dive per pillar (richer than the A3 card grid, slots after A3): headline benefit, 2–3 proof points, real product screenshot — alternating left/right layout | scroll-linked screenshot swap per pillar |
| A12 | How it works | 3 steps (install snippet → send data → see everything) — each step carries a **real screen thumbnail** from the Stage-4 templates (design.md §8.1), no abstract art; extends A5's diagram | step thumbnail → matching A4 demo card |
| A13 | For developers — Contribute | stack line (**Go gRPC services · Next.js + React/TS · ClickHouse · OpenTelemetry** — corrected 2026-07-18 QA loop: the web app is Next.js 16.x + React/TS, verified against `web/package.json`; the store is ClickHouse by the ratified R2 decision, not a generic "columnstore"), "interesting problems" list (ingestion pipeline, query grammar, TSDB), good-first-issues + CONTRIBUTING links, Discord invite, GitHub badge — expands A7's repo links, slots after A7 · the one body section carrying the GitHub + Discord pair (#upstat-lab copy) per the community-CTA placement canon **[Revised 2026-07-19]** | star badge: count populated at runtime — no number in static designs |
| A14 | Self-host | data-ownership pitch (your telemetry, your box), compose one-liner, what ships in the box (every pillar, no feature gates), self-host docs link — expands A7's compose snippet, pairs with A9 | copy button on the one-liner |
| A15 | FAQ | 4–5 product Q&As: cloud vs self-host? · OTel-compatible? · what happens at retention limits? · is everything open-source? · how is this not Datadog? | accordion, single-open |
| A16 | Final CTA band | full-width closing band: one-line pitch + dual CTA **Try Cloud** / **Self Host** (mirrors A2), sits above A10 | |

## Part B — Dashboard (the observability app)

Left icon rail (design.md §2): **Home · Dashboards · Metrics · Logs · Traces ·
RUM/Analytics · Synthetics/Uptime · Monitors · Incidents · SLOs · Service
Catalog · Settings**. Global TimePicker + QueryBar grammar shared across
pillars. Every pillar's empty state = MI-16 inline onboarding.

Screen states **[Directive 2026-07-18]**: the B1/B2/B4/B5 templates ship
explicit empty (EmptyState/MI-16 + first-run copy; demo-data toggle where
specced) and loading (Skeleton) frames per the three-frame rule in
design.md §8.1.

### B1 Home
- Org health at a glance: open incidents banner (MI-14), triggered monitors,
  SLO burn cards (MI-15), watched dashboards row. (Deploy markers CUT from
  v1 — no deploy-events API exists; aspirational item for the service
  catalog era.)
- First-run onboarding **[Directive 2026-07-18]**: create-org screen (name +
  IANA timezone per X-10/B12) → "send your first data" getting-started
  screen (ingestion key + copyable snippet + MI-16 waiting-for-data state);
  resolves to Home on first datapoint.

### B2 Dashboards
- List (org-shared, favorites) → grid editor (MI-11/12): widget types:
  timeseries, query value, top list, table, heatmap, log stream, trace
  latency, SLO, status, service map, markdown.
- Template variables (`$env`, `$service`) with dropdown bar; JSON
  import/export of dashboard definitions **[Proposed: portable format]**.
- Create-dashboard flow + widget picker **[Directive 2026-07-18]**: name →
  widget picker overlay (type grid from the list above) → lands in MI-11
  edit mode.

### B3 Metrics
- Explorer: QueryBar (metric, filters, group-by, aggregation, rollup) → chart
  with MI-2/3; save-to-dashboard.
- Metrics summary: catalog with cardinality, ingestion rate, last seen; tag
  explorer.
- Ingestion: OTLP metrics + StatsD-compatible endpoint **[Proposed]**.

### B4 Logs
- Explorer: FacetSidebar (service, level, host, custom) + QueryBar + LogLine
  list (virtualized) + histogram header (MI-6); live tail (MI-4); expand
  pivots (MI-5).
- Patterns view: auto-grouped similar lines with counts **[Later]**.
- Retention/indexing settings per source; archive-to-object-storage
  **[Later]**.

### B5 Traces (APM)
- Service list: req/s, p50/p95/p99, error rate, apdex-ish score; click →
  service page (endpoints table + latency distribution + deps).
- Trace explorer: search by service/endpoint/duration/status → TraceWaterfall
  (MI-7) with span drawer (tags, logs-in-span, process info).
- Service map: force-layout hexagons (design.md), edge tooltips with
  throughput/error/latency.

### B6 RUM / Website analytics
- The Phase-1 events layer grows into RUM: page views, sessions (cookieless
  visitor model per data-model.md), core web vitals (LCP/CLS/INP from the
  browser SDK), top pages/referrers/devices/geo; error tracking (JS errors
  grouped by fingerprint).
- Website-traffic analytics live in this pillar — B6 is the product's
  analytics surface (ANA-002).
- Property create **[Directive 2026-07-18]**: RUM property-create screen
  (site/domain → property key issuance + browser-SDK snippet; keys managed
  in B12).

### B7 Synthetics / Uptime (the current core, absorbed)
- **Coexistence contract [Decided]**: existing gRPC monitors ARE the uptime
  pillar — at monitors-v2 (OBS-006) each becomes a `MONITOR_RULE` with
  `signal: uptime` via one-time migration; no dual-write period (v2 reads
  both until migration completes within the release). B7 reads the unified
  view.
- Monitors (existing CRUD) → "Uptime checks" within Synthetics: HTTP checks
  (existing), multi-step API checks **[Later]**, browser checks **[Later]**.
- UptimeCards + per-monitor page: check history, response-time chart,
  incidents, insight panel (existing ML insight surfaces here).
- Public status pages: URL scheme **[Decided]** `status.upstat.cuesoft.io/{slug}`
  (owner-chosen slug, unique; never raw owner ids in URLs); upstat's own page
  = slug `upstat` (U0-5 config = create the slugged page over the existing
  `GetStatusPage` data). Builder (logo, components, subscribe) **[Later]**.

### B8 Monitors (alerting on any signal)
- Monitor types: uptime state (exists conceptually), metric threshold,
  log count/pattern, trace latency/error-rate, SLO burn rate.
- Rule editor: query + thresholds (warn/crit) + evaluation window + MI-9
  test-replay; notification channels (email, webhook, Slack **[phased]**),
  cooldown/renotify, mute windows.
- Triggered feed with MI-14; monitor status page (grouped by state).
- Create-monitor form **[Directive 2026-07-18]**: monitor type picker →
  rule editor as a dedicated create screen.
- Rule test/replay state **[Directive 2026-07-18]**: the MI-9 replay
  rendered as its own frame — trigger bands + would-have-fired markers over
  the last 24h.

### B9 Incidents
- Existing incident records grow into incident management: declare (from
  alert or manual), sev levels, roles (commander/responders), timeline
  composer (MI-10), status page linkage, postmortem doc template on resolve
  **[Proposed]**.
- Declare-incident modal state **[Directive 2026-07-18]**: modal (sev
  picker, title, commander assignment) reachable from an alert row or
  manually.

### B10 SLOs
- Define: SLI source (uptime check, metric ratio, latency threshold), target
  (99.9%), window (30d rolling); SLOCards with burn (MI-15); burn-rate
  monitors one click away.

### B11 Service catalog
- Registry: service name, owner, repo/runbook links, environments, telemetry
  presence indicators per pillar; feeds the map + QueryBar autocomplete.

### B12 Settings
- Org/members/roles; **API keys & ingestion tokens** (per-pillar scopes);
  property keys (RUM); integrations (webhooks, Slack); retention per signal;
  usage metering per pillar **[Proposed]**; privacy/data controls.
- **Organization profile**: name, **timezone (IANA)** — all report rendering
  and time-bucketing (dashboards, uptime day boundaries, rollup display,
  scheduled reports) resolve in the org timezone; storage stays UTC
  (analytics-math.md §3). Deliberately the entire upstat identity
  requirement per X-10 tier-1-minimal (decisions.md).

## Part C — Mobile companion (later; parity direction **[Directive]**)

Sketch: on-call-first app — incident push, ack/resolve, sev timeline
posting, monitor mute, status overview. Not scheduled before B-pillar
maturity.

## Feature register delta (extends prd.md)

| ID | Pillar / feature | Priority | Depends on |
| --- | --- | --- | --- |
| OBS-001 | OTLP ingestion gateway (traces, metrics, logs) + SDK/collector docs | Must | TSDB/columnstore decision (architecture.md §"storage") |
| OBS-002 | Metrics explorer + storage | Must | OBS-001 |
| OBS-003 | Logs explorer + live tail + facets | Must | OBS-001 |
| OBS-004 | APM: services, trace explorer, waterfall, service map | Must | OBS-001 |
| OBS-005 | Composable dashboards (grid editor, portable JSON) | Must | OBS-002 **or** OBS-003 (either signal suffices) |
| OBS-006 | Monitors on any signal + channels | Must | pillar queries |
| OBS-007 | RUM: browser SDK (vitals, errors) atop events layer | Must | events layer (Phase 1) |
| OBS-008 | Incident management (sev, roles, timeline, postmortem) | Should | OBS-006 |
| OBS-009 | SLOs + burn-rate monitors | Should | OBS-002 |
| OBS-010 | Service catalog | Should | OBS-004 |
| OBS-011 | Synthetics beyond HTTP (multi-step API, browser checks) | Later | B7 |
| OBS-012 | Log patterns, archives; usage metering | Later | OBS-003 |

Cross-refs: ingestion/storage architecture + supersession note →
architecture.md (appended section); entities → data-model.md §5; API →
api.md §6; phasing → roadmap.md revision.
