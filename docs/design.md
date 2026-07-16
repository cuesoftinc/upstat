# Upstat — Design Language

> Reference feel: **datadoghq.com** — dense, data-first observability UI with
> a confident purple identity; marketing site clean and product-led. Markers:
> **[Directive]** = user-stated direction (2026-07-16), **[Proposed]** =
> ratifiable decision. Pages in [pages.md](pages.md) reference
> microinteractions here as `MI-n`.

## 1. Design principles

1. **Time is the primary axis** — a global time picker governs every view;
   all graphs share cursor, zoom, and range. Nothing renders without its
   time context.
2. **Density with hierarchy** — Datadog-class UIs win by showing a lot
   without chaos: strict typographic scale, hairline dividers, color reserved
   for signal (status, series), never decoration.
3. **Every pixel is a pivot** — hover anything (point, log line, service
   node) → rich context; click → filtered drill-down. Dead-end views are
   defects.
4. **Keyboard + query duality** — every UI filter state has a query-string
   representation (shareable URLs); power users type, others click — same
   result.

## 2. Foundations

### Color **[Proposed]**

> **Brand reconciliation (2026-07-16):** the existing Figma landing design is
> **dark-first with a mint/teal accent** — that is Upstat's actual brand, and
> it stays. "datadoghq.com look and feel" contributes the *data-UI patterns*
> (density, pillar nav, synced graphs), not Datadog's purple. The `brand`
> token below is teal, sampled from the file: **#00E09E** (primary, 63 uses)
> with **#00A991** as `brand-deep` — both now live in the `upstat/tokens`
> variable collection (§7).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | #FFFFFF | #0E1113 | canvas (dashboards + marketing default dark, per the existing landing; light mode supported) |
| `bg-elev` | #F7F8FA | #171B1E | panels, cells |
| `border` | #E4E6EB | #262C30 | hairlines |
| `text` | #1B1D22 | #EDEEF2 | primary |
| `text-2` | #6B6F7B | #9BA0AC | secondary |
| `brand` | #00E09E | #00E09E | nav, CTAs, focus (sampled from the landing) |
| `brand-deep` | #00A991 | #00A991 | hover/active brand states, secondary accents |
| `ok` | #2E9950 | #3DCC70 | up / passing |
| `warn` | #C77D00 | #FFB020 | degraded / warn thresholds |
| `crit` | #D32F2F | #FF5C5C | down / alerting |
| `nodata` | #9AA0AA | #5C6270 | no data / muted monitors |
| Series palette | 8-step categorical **[Decided]**: `#7C6CF0 #00B4D8 #F4A259 #E86A92 #43AA8B #B5179E #FFCA3A #4361EE` (validated ≥3:1 against both `bg` values; colorblind-checked) | same | charts; series→color stable per view session |

Status semantics are sacred: `ok/warn/crit/nodata` colors are reserved — never
used decoratively anywhere in the product. Because the brand accent is teal,
`ok` green must stay visually distinct from `brand` (bluer/deeper green;
verified in both themes) — the one extra constraint the teal brand imposes.

### Type & numerals

- UI: `Inter`; data/query/code: `JetBrains Mono` (log lines, queries, IDs).
- Type ramp **[Decided]**: 11 (axis labels) / 12 (dense meta) / **13 base**
  (data views, lh 1.45) / 14 (settings/forms) / 16 (panel titles, 600) /
  20 (page titles, 600) / 24–32 (marketing only); weights 400/500/600;
  tabular figures in all numeric contexts; fixed-precision latencies
  (`142 ms`, `1.24 s`).

### Layout

- Left product nav (Datadog pattern): icon rail 56px with flyout labels;
  sections = pillars (§pages.md B). Top bar: org/env switcher · **global time
  picker** · search (`/`) · incidents bell.
- Views: filter bar (query pills) → visualization canvas → detail drawer
  (right, 480px) for point/line/span inspection.
- Grid dashboards: 12-col draggable/resizable widgets (react-grid-layout
  class behavior), 8px gutters.
- Radii 4px (denser than siblings); hairlines everywhere; elevation only for
  drawers/palettes.


### Shared foundations (ecosystem parity — identical across the three products)

| Foundation | Value |
| --- | --- |
| Spacing scale | 4px base grid: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` — no off-scale values; component padding uses the scale, not arbitrary numbers |
| Breakpoints | `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536` (Tailwind-aligned); mobile-first media queries |
| Motion durations | `fast 120ms · base 200ms · slow 300ms · entrance 250ms` — MI specs quote exact values, these are the defaults |
| Motion easing | standard `cubic-bezier(0.2, 0, 0, 1)`; exit `cubic-bezier(0.4, 0, 1, 1)`; springs only where an MI names one |
| Z-index layers | `base 0 · sticky 10 · dropdown 20 · overlay 30 · sheet/modal 40 · toast 50` — nothing outside these six |
| Iconography | **Lucide** (24px stroke default) everywhere; product-specific icons only as approved additions in the Figma Style Guide |
| Focus states | 2px accent ring, 2px offset, `:focus-visible` only — identical rule all products |
| Radii (product) | 4px |
| Product note | data views may compress to the 4px sub-grid (2px hairline gaps in dense tables) |

These rows are standardized in the org SKILL.md — a change here is an
ecosystem change, PR'd to all three design.md files together.

## 3. Component inventory

| Component | Anatomy | Notes |
| --- | --- | --- |
| `TimePicker` | presets (15m/1h/4h/1d/1w/custom) + absolute range + live toggle | global, URL-synced; "live" pulses a dot |
| `QueryBar` | tokenized pills (`service:api-common` `status:error`) + free text; autocomplete from facets | shared grammar across logs/metrics/traces **[Proposed]** |
| `TimeseriesPanel` | title · query chip · chart (line/area/bars) · legend with per-series toggle | crosshair synced across all panels in view (MI-2) |
| `StatusPill` | dot + label (`ok/warn/crit/nodata`) | breathing animation only while state is `crit` (MI-8) |
| `UptimeCard` | monitor name · 90-day bar strip · uptime % · latency sparkline | the classic status strip; bars tooltip per-day detail |
| `LogLine` | ts · level chip · service · message (mono, truncated) | expand → JSON tree with copy-paths (MI-5) |
| `TraceWaterfall` | span rows: name, service color, duration bar on time axis | hover span → mini-summary; click → span drawer |
| `ServiceMapNode` | hexagon: service name + req/s + error % ring | force-layout map; edges animate flow direction |
| `MonitorRow` | status pill · name · query summary · last triggered · muted toggle | |
| `IncidentBanner` | sev chip · title · age · responders avatars | global banner while any sev1/2 open |
| `SLOCard` | target vs actual · error-budget bar (burn colored) | budget bar depletes right-to-left |
| `FacetSidebar` | checkbox facets with counts, top-N | logs/traces explorers |
| `WidgetShell` | dashboard widget chrome: title, query, ⋯ menu (edit/duplicate/fullscreen/export) | drag handle appears on hover |

## 4. Microinteraction catalog

| ID | Interaction | Spec |
| --- | --- | --- |
| MI-1 | **Global time sync** | changing TimePicker animates all panels' x-domains 250ms; URL updates; back/forward restores |
| MI-2 | **Synced crosshair** | hovering any chart draws vertical cursor + value dots on *every* panel in view; tooltip follows with per-series values; 0ms delay, rAF-throttled |
| MI-3 | **Drag-to-zoom** | drag horizontal region on any chart → all panels zoom to range with 200ms ease; double-click resets; breadcrumb chip shows zoom stack |
| MI-4 | **Live tail** | logs stream with 150ms batch flush; user scroll-up pauses (PAUSED pill + buffered count "▼ 128 new"); click resumes with smooth catch-up scroll |
| MI-5 | **Log expand** | line expands accordion-style to JSON tree; keys hover → copy-path icon; `⌘click` a value → adds `key:value` pill to QueryBar (the signature pivot) |
| MI-6 | **Facet filtering** | checking a facet animates result count + charts re-query with 120ms crossfade; pills appear in QueryBar |
| MI-7 | **Span hover** | waterfall span highlights its service color across the map minimap; duration label pops 1.05× |
| MI-8 | **Status transitions** | pill color crossfades 300ms + single pulse on worsening (never on recovery — recovery is calm); status strip bars fill on first render 400ms stagger |
| MI-9 | **Monitor test** | "Test rule" replays last 24h against thresholds → chart overlays trigger bands + would-have-fired markers |
| MI-10 | **Incident timeline composer** | timeline entries slide-in; slash-commands (`/status resolved`, `/sev 2`) autocomplete; posting an update optimistically prepends with clock-sync check |
| MI-11 | **Dashboard editing** | drag ghost + snap guides; resize live-reflows neighbors; save pulses the Saved chip; `e` toggles edit mode |
| MI-12 | **Widget fullscreen** | widget zooms to viewport 250ms (FLIP), ESC returns; keeps crosshair sync with origin dashboard |
| MI-13 | **Query autocomplete** | facet suggestions ranked by cardinality; tab completes; syntax errors underline red with hover explanation |
| MI-14 | **Alert flash** | new alert event flashes the nav bell + adds row to alert feed with 300ms slide; sev1 adds persistent IncidentBanner |
| MI-15 | **SLO budget burn** | budget bar animates depletion on load; burn-rate > threshold ignites a subtle flame icon (calm UI otherwise) |
| MI-16 | **Empty/onboarding states** | every pillar's empty state = 3-step inline setup (install snippet with copy ✓, "waiting for data…" radar sweep, docs link); radar sweep stops on first datapoint with a satisfying ping |
| MI-17 | **Keyboard map** | `g d` dashboards, `g l` logs, `g m` monitors, `/` search, `?` overlay cheatsheet |
| MI-18 | **Saved views** | saving a filter set morphs QueryBar into a named chip; org-shared views get avatar stack |

## 5. Accessibility & motion

- Status never color-only: pills carry labels/icons; charts offer pattern
  fills in colorblind mode.
- `prefers-reduced-motion`: no pulses/sweeps; state changes are instant
  crossfades; live tail unaffected (data, not decoration).
- All charts expose data-table toggle; log lines fully keyboard-navigable
  (j/k, enter expands).
- Contrast ≥4.5:1 both themes including series-on-dark validation.

## 6. Platform parity map

| Surface | Now | Target |
| --- | --- | --- |
| Home (public) | `/` page + Figma landing design | pages.md Part A (Datadog-style product-led marketing) |
| Dashboard | monitor CRUD + mock analytics pages | pages.md Part B — pillar-based observability app |
| Mobile | — | later: on-call/incident companion app sketch (pages.md Part C) — parity direction **[Directive]** |

## 7. Figma Style Guide (source of truth for tokens)

The design system lives in the product's Figma file on a dedicated **Style
Guide** page, backed by a variable collection **`upstat/tokens`**. The file's plan allows a single variable mode, so themes are expressed as **`light/` and `dark/` variable groups** (same token names in each) rather than modes — migrate to true modes if the plan changes. Every color token in §2 exists as a Figma
variable (scopes: frame/shape/text fills + strokes) so designs bind to tokens,
never raw hexes; the Style Guide page renders swatches (both modes), the type
scale, and status/accent samples. Token changes happen in Figma first, then
sync back into this document — the two must never diverge. Type styles and
component samples are the next Style Guide iteration.

## 8. Figma component build plan (design phase)

> Work order over the live `upstat/tokens` collection + Style Guide page
> (§7). Dark theme is primary; every component ships both themes. The
> existing landing design (Desktop-1) is the base for Stage 5.

### 8.1 Build order

| Stage | Build | Unlocks |
| --- | --- | --- |
| 0 Foundations | type ramp (§2) · series palette swatches ×8 · Lucide icons · 12-col dashboard grid + 8px gutters | everything |
| 1 Atoms | Button, Input, StatusPill, query pill, level chip, Toast | molecules |
| 2 Molecules | TimePicker, QueryBar (pills+autocomplete), FacetSidebar group, MonitorRow, LogLine (collapsed/expanded), SLOCard, IncidentBanner, UptimeCard | panels |
| 3 Panels | TimeseriesPanel (line/area/bars + legend), WidgetShell, TraceWaterfall row, ServiceMapNode, alert channel/rule forms | dashboards |
| 4 Screen templates | dashboard home, monitors list+detail, alert config, traffic (real-data layout), status page (slug public view), settings/properties | app design |
| 5 Landing | extend Desktop-1: pillar grid (8), ingestion diagram section, demo cards, cloud-vs-oss | landing v2 |

### 8.2 Variant matrices

| Component | Variants × states |
| --- | --- |
| StatusPill | ok / warn / crit (breathing) / nodata / paused / pending · dot+label / dot-only |
| TimePicker | preset selected ×6 / custom range open / live (pulsing dot) |
| QueryBar | empty / pills / autocomplete open / syntax-error (red underline + hint) |
| TimeseriesPanel | line / area / bars · with/without legend · loading (axis-first) / empty (radar sweep MI-16) / crosshair active |
| UptimeCard | all-up / with-outage-bars / nodata-gaps · % footer |
| LogLine | collapsed / expanded (JSON tree) / level ×5 tints |
| MonitorRow | status ×6 · muted toggle on/off |
| IncidentBanner | sev1 / sev2 (persistent) · resolved (transient) |
| SLOCard | healthy / burning (flame) / exhausted |
| WidgetShell | view / edit (drag handle) / fullscreen |
| ServiceMapNode | healthy / erroring (ring %) / selected |
| Alert forms | channel: webhook / email · unverified / verified / degraded |
| EmptyState | per-pillar MI-16 (snippet + radar + docs link) ×4 minimum |

### 8.3 Design-prep needed from content

Synthetic telemetry series (realistic p50/p95 shapes, an outage window, a
flapping window) for honest-looking panels; log fixture lines; the 90-day
uptime strip data pattern.
