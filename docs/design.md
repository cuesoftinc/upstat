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
> token below is teal; exact hex sampled from the Figma file into the
> `upstat/tokens` variable collection (§7).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | #FFFFFF | #0E1113 | canvas (dashboards + marketing default dark, per the existing landing; light mode supported) |
| `bg-elev` | #F7F8FA | #171B1E | panels, cells |
| `border` | #E4E6EB | #262C30 | hairlines |
| `text` | #1B1D22 | #EDEEF2 | primary |
| `text-2` | #6B6F7B | #9BA0AC | secondary |
| `brand` | teal (sampled from landing, ~#2AD8A4 family) | same | nav, CTAs, focus — final hex from the Figma sample |
| `ok` | #2E9950 | #3DCC70 | up / passing |
| `warn` | #C77D00 | #FFB020 | degraded / warn thresholds |
| `crit` | #D32F2F | #FF5C5C | down / alerting |
| `nodata` | #9AA0AA | #5C6270 | no data / muted monitors |
| Series palette | 8-step categorical (colorblind-safe, starts purple) | — | charts; consistent series→color per view session |

Status semantics are sacred: `ok/warn/crit/nodata` colors are reserved — never
used decoratively anywhere in the product. Because the brand accent is teal,
`ok` green must stay visually distinct from `brand` (bluer/deeper green;
verified in both themes) — the one extra constraint the teal brand imposes.

### Type & numerals

- UI: `Inter`; data/query/code: `JetBrains Mono` (log lines, queries, IDs).
- Base 13px in data views (density), 14px in settings/forms; tabular figures
  in all numeric contexts; fixed-precision latencies (`142 ms`, `1.24 s`).

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
Guide** page, backed by a variable collection **`upstat/tokens`** with
**Light** and **Dark** modes. Every color token in §2 exists as a Figma
variable (scopes: frame/shape/text fills + strokes) so designs bind to tokens,
never raw hexes; the Style Guide page renders swatches (both modes), the type
scale, and status/accent samples. Token changes happen in Figma first, then
sync back into this document — the two must never diverge. Type styles and
component samples are the next Style Guide iteration.
