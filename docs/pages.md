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
| A1 | Nav | logo · Features (anchors the A11 feature-highlights band, `/#features` — differentiated from Platform 2026-07-19) · Platform (anchors to the A3 pillar grid) · Docs (GitBook) · GitHub star badge (neutral "Star") · ThemeToggle · Sign in text link · **Try Cloud** CTA **[Revised 2026-07-19]** | Features dropdown = mini feature map ×8 — as built 2026-07-20 per the Figma `dropdown-open` variant: desktop hover/chevron-click disclosure reusing the PillarCard set (series-accent icons, Figma short labels), rows deep-link `/#pillar-n` on the A3 grid; Escape/focus-out close; the mobile panel keeps the plain link. **[Decided 2026-07-20]** the dropdown supplements the 4-text-links canon — the link inventory is unchanged (Features keeps `/#features`) |
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
| A14 | Self-host | data-ownership pitch (your telemetry, your box), tabbed snippet **Docker Compose \| Helm** (CodeSnippet `tab=docker/helm`, same master as the SDK tabs): mirrored two-line commands — `git clone https://github.com/cuesoftinc/upstat` then `cd upstat && docker compose up --build -d` (Makefile `up` target) vs `cd upstat && helm install upstat deploy/helm` — only the final command differs, with a muted caption under the block ("Compose ships MongoDB; the Helm chart expects yours (MONGO_URI). All 8 pillars come up on :3000.") **[Ratified 2026-07-20]**, what ships in the box (every pillar, no feature gates), self-host docs link — pairs with A9 | copy button on the snippet |
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
  list (virtualized — as built 2026-07-20: bespoke spacer windowing over
  fixed 29px rows, `controllers/virtual-window.ts`; page size is
  URL-addressable `?limit=` up to 10k; MI-4 pause/buffer and MI-5
  expansion semantics preserved, expansion lifted to the list) + histogram
  header (MI-6); live tail (MI-4); expand pivots (MI-5).
- Patterns view **[Designed 2026-07-20; as built 2026-07-20]**: a
  "Patterns" tab beside the explorer list (`?tab=patterns`, deep-linkable)
  — LogPatternRow per clustered template (expand chevron · count ·
  7-bucket trend sparkline · Mono template with `<placeholders>` ·
  dominant-level chip), expanding to indented sample LogLines (Figma "B4 —
  Logs (patterns)"). As built the clustering runs in the mock over the
  same per-second line generator as the stream; shares the QueryBar/facet
  chrome and the global time range (LIVE clusters the last 15 minutes);
  **[Decided 2026-07-20]** ranges wider than the enumeration budget sample
  every nth second with stride-scaled counts (rendered with a `~`). The
  real backend clustering lands with OBS-012.
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
- Deeper analytics drill-down (U6-2) **[Designed 2026-07-20; as built
  2026-07-20]**: `/dashboard/rum/drilldown`, routed from the pillar header
  — funnel row (FunnelStageCard chain — page views → sessions →
  conversions, per-stage conversion %), retention weekly-cohort grid (the
  Heatmap construction re-axised to 8 Monday-aligned cohorts × wk 0–6),
  top pages / top referrers TopLists (Figma "B6 — RUM analytics drill-down
  (U6-2)"). **[Decided 2026-07-20]** the conversion stage counts the
  registered signup event (`auth_signin_completed`, api.md §3.4) and the
  definition is labeled in-page (accuracy canon); page views/sessions are
  the B6 summary's own numbers.

### B7 Synthetics / Uptime (the current core, absorbed)
- **Coexistence contract [Decided]**: existing gRPC monitors ARE the uptime
  pillar — at monitors-v2 (OBS-006) each becomes a `MONITOR_RULE` with
  `signal: uptime` via one-time migration; no dual-write period (v2 reads
  both until migration completes within the release). B7 reads the unified
  view.
- Monitors (existing CRUD) → "Uptime checks" within Synthetics: HTTP checks
  (existing), multi-step API checks and browser checks **[Designed
  2026-07-20; as built 2026-07-20]** — the builder
  (`/dashboard/uptime/new`, type tabs HTTP / Multi-step / Browser) composes
  SyntheticStepRow steps (HTTP request / assertion / wait; add, reorder —
  keyboard grip + pointer drag —, delete) plus a browser-check panel (URL ·
  viewport Select · screenshot-on-failure Switch); the run view
  (`/dashboard/uptime/checks/{id}`, `?run=` selects) is a per-step
  pass/fail timeline (StepResultRow + UptimeCard context + failure-
  screenshot card) with stop-at-first-failure semantics. Figma "B7 —
  Synthetic check builder (multi-step)" and "B7 — Synthetic check run
  (multi-step results)". **[Decided 2026-07-20]** the HTTP tab stays the
  classic Monitor create; multi-step/browser checks are a separate
  `/v1/synthetics` entity until monitors-v2 unifies signals; the run
  view's UptimeCard context is derived — the monitor watching the first
  HTTP step's host — not a configured link. The real runner lands with
  OBS-011.
- UptimeCards + per-monitor page: check history, response-time chart,
  incidents, insight panel (existing ML insight surfaces here).
- Public status pages: URL scheme **[Decided]** `status.upstat.cuesoft.io/{slug}`
  (owner-chosen slug, unique; never raw owner ids in URLs); upstat's own page
  = slug `upstat` (U0-5 config = create the slugged page over the existing
  `GetStatusPage` data). Builder **[Designed 2026-07-20; as built
  2026-07-20]**: settings surface (`/dashboard/settings/status-page`,
  linked from the overview) — branding rows (page name · slug),
  StatusPageBuilderRow component list (add/rename/reorder, monitor mapping
  via Select) and a public-URL preview row; the public page it produces is
  the existing `/status/{slug}` construction — saved names, order and the
  page-name header render there directly (orgs without a saved document
  keep deriving components from their live monitors). Subscribe affordance
  **[Later]**.

### B8 Monitors (alerting on any signal)
- Monitor types: uptime state (exists conceptually), metric threshold,
  log count/pattern, trace latency/error-rate, SLO burn rate.
- Rule editor: query + thresholds (warn/crit) + evaluation window + MI-9
  test-replay; notification channels (email, webhook, Slack **[phased]**),
  cooldown/renotify, mute windows.
- Triggered feed with MI-14; monitor status page (grouped by state) —
  **[Decided 2026-07-20]** read literally as a grouped view of the
  monitors list: the B8 rules list carries a List | By state toggle
  (URL-addressable `?view=state`); By state groups rules worst-first —
  Triggered (alert) / Warn / OK / No data / Muted — with counts, any mute
  window winning over evaluation state (the rule editor's mute
  semantics). Uptime checks remain surfaced on B7 until monitors-v2
  unifies them as MONITOR_RULEs (the B7 coexistence contract).
- Create-monitor form **[Directive 2026-07-18]**: monitor type picker →
  rule editor as a dedicated create screen.
- Rule test/replay state **[Directive 2026-07-18]**: the MI-9 replay
  rendered as its own frame — trigger bands + would-have-fired markers over
  the last 24h.

### B9 Incidents
- Existing incident records grow into incident management: declare (from
  alert or manual), sev levels, roles (commander/responders), timeline
  composer (MI-10), status page linkage, postmortem doc template on resolve
  **[Decided 2026-07-20, built]** — resolved incidents gain **Start
  postmortem**: a composer modal with the incident timeline auto-filled
  (frozen into the doc) plus impact / root-cause / action-items sections;
  the saved doc lists on the incident detail and stamps `postmortem_key`.
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
- **[Ratified 2026-07-20]** Route-backed tabs: a settings-local underline
  tab bar (the §8.2b tab grammar) under the page title; each tab is a
  real sub-route, deep-linkable, and the bare `/dashboard/settings`
  redirects to the first tab (`/general`). Seven tabs: **General**
  (`/general`) · **Members** (`/members` — members/roles) · **Keys &
  properties** (`/keys` — API keys & ingestion tokens (per-pillar scopes)
  + property keys (RUM)) · **Integrations** (`/integrations` — webhooks,
  Slack; carries the status-page builder handoff — the B7 builder stays a
  focused sub-screen at `/dashboard/settings/status-page` outside the tab
  shell) · **Data & privacy** (`/retention`, its pre-tab URL — retention
  per signal; privacy/data controls) · **Appearance** (`/appearance` —
  tri-state theme, colorblind mode) · **Usage** (`/usage`, its pre-tab
  URL).
- **General — organization profile**: name, **timezone (IANA)** — all
  report rendering and time-bucketing (dashboards, uptime day boundaries,
  rollup display, scheduled reports) resolve in the org timezone; storage
  stays UTC (analytics-math.md §3). Deliberately the entire upstat
  identity requirement per X-10 tier-1-minimal (decisions.md).
- **Usage — metering per pillar** **[Designed 2026-07-20; as built
  2026-07-20]** — /dashboard/settings/usage: UsageMeterRow per pillar
  (measure · MTD value · MTD bar · plan column verbatim "Self-host:
  unlimited · Cloud: announced at GA", accuracy canon; Figma "B12 —
  Settings (usage metering)"); values computed from the seeded telemetry
  volumes, month boundaries in the org timezone (X-10). **[Decided
  2026-07-20]** the bar denominators are per-pillar trailing-3-month
  peaks (the design.md §8.2b contract) — the earlier "scaled to the
  largest meter" phrasing is cross-unit and unimplementable as stated.

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
