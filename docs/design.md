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
| `on-brand` | #0E1113 | #0E1113 | labels/knobs on `brand` fills **only** — **[Decided 2026-07-16]** dark ink in *both* modes (brand teal is bright; fixes the light-mode white-on-teal contrast flag). **[Decided 2026-07-17]** destructive-fill labels stay raw `#FFFFFF` pending a possible `on-crit` token — `on-brand` does not extend to `crit` fills (matches the built destructive Button; recorded so docs and build no longer diverge silently) |
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
- Type ramp **[Decided]**: **10 micro** (chip type — TopBar env chip,
  MemberRow role chip, APIKeyRow kind/scope chips, Avatar initials/+n,
  CountBadge, ErrorGroupRow state chip; Inter + JetBrains Mono twins,
  named `Micro/10` / `Mono/Micro 10` in Figma) **[Ratified 2026-07-19]** /
  11 (axis labels) / 12 (dense meta) / **13 base** (data views, lh 1.45) /
  14 (settings/forms) / 16 (panel titles, 600) / 20 (page titles, 600) /
  24–32 (marketing only) · **marketing display extension [Ratified
  2026-07-19]**: landing hero h1 **34/44** and final CTA band **26/32**
  (mobile/desktop responsive pairs; desktop steps are the named
  `Display/44` / `Display/32` Figma styles, Stage-5 marketing only);
  weights 400/500/600; tabular figures in all numeric contexts;
  fixed-precision latencies (`142 ms`, `1.24 s`).

### Layout

- Left product nav (Datadog pattern) **[Directive 2026-07-19]**: expandable
  rail — collapsed 56px icon rail (flyout labels on hover) ⇄ expanded 240px
  with icon+label rows grouped by pillar section (Telemetry / Respond /
  Platform); sections = pillars (§pages.md B). Chevron toggle at the rail foot
  switches state; the choice persists per user across sessions
  (`nav.rail.expanded` in localStorage). Default: expanded on desktop ≥1280px,
  collapsed below. **[Clarified 2026-07-19]** Below `md` expansion must never
  squeeze the content: the persisted state does not apply (mobile always
  boots the 56px rail) and the foot chevron opens a 240px **overlay drawer**
  over a scrim instead — content keeps full width beneath; scrim tap,
  Escape, and item selection close it. Active item = brand accent bar +
  brand icon in both states.
  Top bar: org/env switcher · **global time picker** · search (`/`) ·
  theme toggle · incidents bell (**[Directive 2026-07-19]** the toggle joins
  the utility cluster; see the parity canon below).
- Views: filter bar (query pills) → visualization canvas → detail drawer
  (right, 480px) for point/line/span inspection.
- Grid dashboards: 12-col draggable/resizable widgets (react-grid-layout
  class behavior), 8px gutters.
- Radii 4px (denser than siblings); hairlines everywhere; elevation only for
  drawers/palettes.
- Marketing container **[Decided 2026-07-19]**: all landing/marketing sections
  share **one centered content container — 1152px at the 1440 design width**
  (rails x 144 / x 1296), min 24px side gutters at narrower viewports. Section
  band backgrounds (final CTA, footer) run full-bleed; their content stays on
  the rails. Two-column sections hang right-hand blocks on a secondary column
  line at x 816 (= right rail − 480). **As built (2026-07-19):** Figma Home
  135:2 (landing v2) retro-aligned to these rails from a drifted 1100px/x 170
  container (worst offenders: pillar grid ending at x 1220, how-it-works col 3
  overflowing to x 1375.6, footer band at x −8). The `MarketingNav` *instance*
  on the frame widened 1100 → 1152 (auto-layout main component untouched);
  interior grids on the container: pillar grid 4×270px cols, how-it-works
  3×368px cols — both 24px gutters. All 15 sections re-audited to zero
  deviation.
- Marketing nav, footer & theme parity **[Directive 2026-07-19]** (SKILL.md
  "Marketing nav, footer & theme parity canon", ratified 2026-07-19): all
  three products share ONE link inventory — same sections, counts and
  destinations; upstat renders it in its own dark visual design.
  - **Nav** **[Revised 2026-07-19]**: 4 text links Features (anchors the
    landing feature-highlights band, `/#features` — differentiated from
    Platform, which anchors the pillar grid; the two previously shared one
    anchor) · Platform (upstat product slot — anchors to the landing
    pillar-grid section) · Docs (GitBook root) · GitHub — the GitHub item
    renders as a compact star badge (star glyph + neutral "Star" label; no
    count on canvas — the live star count is runtime behavior) — +
    ThemeToggle control + **"Sign in" text link** (`/signin`) + **"Try
    Cloud"** brand CTA. (No Platform-dropdown/Community links; the pillar
    mini feature map ships as the Features dropdown — the MarketingNav
    `state=dropdown-open` variant, as built 2026-07-20; the canonical link
    inventory is unchanged.)
  - **Footer**: brand block (wordmark + tagline) + 4 pinned columns — Product
    (Features · Try Cloud · Self Host · Platform) / Docs (Docs · Quickstart
    · API reference · Self-host guide) / Community (GitHub · Discord ·
    Roadmap · CueLABS™) / Legal (Privacy · Terms · Status) — + legal bar
    verbatim **"© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT
    License."** with a language selector (English-only, ships ahead of i18n
    by ratified decision) and a security-policy affordance (SECURITY.md).
  - **Theme toggle everywhere**: marketing nav AND dashboard chrome (TopBar)
    and settings; three-state cycle light → dark → system (system follows
    live `prefers-color-scheme`) **[Revised 2026-07-20]**; `data-theme` on
    `<html>`, persisted at localStorage `upstat.theme`, falling back to dark
    (upstat's design default). Every
    canonical href must return HTTP 200; Playwright asserts the inventory on
    both surfaces.


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

- **Cursor affordance**: enabled interactive controls show `cursor: pointer` — one base-layer rule on `button:not(:disabled)`, `[role="button"]:not([aria-disabled="true"])`, `select:not(:disabled)`, `summary`, `label[for]`; links use the native pointer; disabled controls keep the default cursor. [Directive 2026-07-19]

These rows are standardized in the org SKILL.md — a change here is an
ecosystem change, PR'd to all three design.md files together.

## 3. Component inventory

| Component | Anatomy | Notes |
| --- | --- | --- |
| `TimePicker` | presets (15m/1h/4h/1d/1w/custom) + absolute range + live toggle | global, URL-synced; "live" pulses a dot |
| `QueryBar` | tokenized pills (`service:api-common` `level:error`) + free text; autocomplete from facets | shared grammar across logs/metrics/traces **[Proposed; pill grammar reconciled 2026-07-20 — logs facets key on `level:`]** |
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
  fills in colorblind mode — **as built (2026-07-20):** Settings →
  Appearance "Color vision" toggle, persisted like the theme contract
  (localStorage `upstat.colorvision`, `data-colorvision` on `<html>`,
  pre-paint init script; `ColorVisionProvider`); in patterns mode
  TimeseriesPanel strokes take per-series dash arrays and bar fills
  per-series hatch pattern defs (legend swatches mirror the mark),
  TopList bars and LogHistogram level stacks take stripe overlays
  (shared `patternFillStyle`, per-index angle/pitch), and the dot-only
  StatusPill — the one color-only chip — swaps its dot for a per-status
  glyph (labeled pills/SevChips already carry text; the Heatmap's
  single-hue intensity ramp is not hue-encoded and is unchanged).
- `prefers-reduced-motion`: no pulses/sweeps; state changes are instant
  crossfades; live tail unaffected (data, not decoration).
- All charts expose data-table toggle; log lines fully keyboard-navigable
  (j/k, enter expands) — **as built (2026-07-20):** shared
  ChartTableToggle + ChartDataTable affordance ("View as table",
  `aria-pressed`, the §8.2 Table construction in a scroll-bounded
  container) on TimeseriesPanel (header control; floating corner control
  on bare widget plots), Heatmap, LogHistogram and UptimeCard; TopList
  already renders as a text list (rank · label · value).
- Contrast ≥4.5:1 both themes including series-on-dark validation.

## 6. Platform parity map

| Surface | Now | Target |
| --- | --- | --- |
| Home (public) | `/` page + Figma landing design | pages.md Part A (Datadog-style product-led marketing) |
| Dashboard | monitor CRUD + mock analytics pages | pages.md Part B — pillar-based observability app |
| Mobile | responsive-web exemplars: `Marketing — Home @390 (menu open + footer stack)` and `B1 — Home @390 (rail overlay drawer)` | later: on-call/incident companion app sketch (pages.md Part C) — parity direction **[Directive; exemplars added 2026-07-20]** |

## 7. Figma Style Guide (source of truth for tokens)

The design system lives in the product's Figma file on a dedicated **Style
Guide** page, backed by a variable collection **`upstat/tokens`** with **true Light and Dark modes** (components bind one token and switch by mode). The collection also carries the foundations as variables: spacing scale, radii, durations, z-index, series palette (8). Every color token in §2 exists as a Figma
variable (scopes: frame/shape/text fills + strokes) so designs bind to tokens,
never raw hexes; the Style Guide page renders swatches (both modes), the type
scale, and status/accent samples. Token changes happen in Figma first, then
sync back into this document — the two must never diverge. Type styles are
built (12 local styles, `Axis/11` through `PageTitle/20` plus three Mono
styles); the remaining iteration is the Style Guide *page* refresh below.

Additions (2026-07-16): (1) the new `on-brand` token (§2) now exists in the
`upstat/tokens` collection — components placing labels/knobs on `brand`
fills bind it instead of a raw ink (**[Decided 2026-07-17]** `on-brand`
applies to brand fills only; destructive-fill labels stay raw `#FFFFFF`
pending a possible `on-crit` token — see §2). (2) OpenType tabular figures
(`tnum`) must be enabled **manually** on numeric text styles in the Figma UI —
the plugin API cannot set font features — so the §2 "tabular figures in all
numeric contexts" rule is applied by hand when each numeric type style is
created or edited.

Updates (2026-07-17): (1) the Style Guide page is being refreshed to match
the collection — add the missing `on-brand` swatch, correct the type samples
(the rendered `Display / 32 Bold` and `Title / 24 Bold` samples contradict
the §2 400/500/600 weight ramp), and render the z-index layer row
(`z/base`…`z/toast` exist as variables but have no swatches) — the page and
this doc must never diverge. (2) the legacy `Variable collection` (font /
ITEM / BACKGROUND / white, single mode — predates `upstat/tokens`) and the
Deprecated-page contents are **quarantined as pending cleanup**: whether and
when to delete them is an owner decision, deliberately not scheduled here.

## 8. Figma component build plan (design phase)

> Work order over the live `upstat/tokens` collection + Style Guide page
> (§7). Dark theme is primary; every component ships both themes. The
> existing landing design (Desktop-1) is the base for Stage 5.

### 8.1 Build order

| Stage | Build | Unlocks |
| --- | --- | --- |
| 0 Foundations | type ramp (§2) · series palette swatches ×8 · Lucide icons — **extended set (2026-07-16)**, see icon note below · approved brand glyphs (Google 'G', GitHub, Discord, Slack) · 12-col dashboard grid + 8px gutters | everything |
| 1 Atoms | Button, Input, StatusPill, query pill, level chip, Toast · **primitives kit (2026-07-16)**: Switch, Checkbox, Tooltip, Avatar/AvatarStack, KbdChip, CountBadge/BufferedCountChip, SevChip, GoogleAuthButton | molecules |
| 2 Molecules | TimePicker, QueryBar (pills+autocomplete), FacetSidebar group, MonitorRow, LogLine (collapsed/expanded), SLOCard, IncidentBanner, UptimeCard, SettingsRow · **overlay/input kit**: Select/DropdownMenu, Modal/Sheet, SavedViewChip, ZoomStackChip · **account kit**: MemberRow, APIKeyRow/PropertyKeyRow, DashboardListRow · **Wave B kit (designed 2026-07-20)**: SyntheticStepRow, StepResultRow, StatusPageBuilderRow, LogPatternRow, UsageMeterRow | panels |
| 3 Panels | TimeseriesPanel (line/area/bars + legend), WidgetShell, TraceWaterfall row + span drawer, ServiceMapNode, alert channel/rule forms · **widget content kit**: QueryValue, TopList, Table, Heatmap, LogHistogram · **status page kit**: StatusPageHeader, StatusPageComponentRow, IncidentHistoryEntry · **chrome kit**: NavRail/NavRailItem, TopBar, CommandPalette/SearchOverlay, ShortcutCheatsheet · **alert/incident kit**: AlertFeedRow + NotificationPopover, IncidentComposer, ThresholdOverlay · **explorer extras**: ServiceCatalogRow, ErrorGroupRow, TraceMinimap · FunnelStageCard (B6 drill-down, designed 2026-07-20) | dashboards + status pages |
| 4 Screen templates | dashboard home, monitors list+detail, alert config, traffic (real-data layout), status page (slug public view), settings (route-backed tabs — underline tab grammar under the page title **[Ratified 2026-07-20]**), **/signin** (the single Google CTA screen per X-1) | app design |
| 5 Landing | extend Desktop-1: pillar grid (8), ingestion diagram section, demo cards, cloud-vs-oss · **marketing kit**: MarketingNav + PillarDropdown, PillarCard, CodeSnippet + Tabs, CloudVsSelfHostTable | landing v2 |

**Stage 4 screen-state rule [Directive 2026-07-18].** Every data-driven
screen template ships **three frames**: default (populated), **empty**
(EmptyState + first-run copy; a demo-data toggle where the screen's spec
calls for one), and **loading** (Skeleton). First application: the pages.md
B1/B2/B4/B5 templates. The loading frames may introduce a **Skeleton**
primitive and the pages.md A15 FAQ a marketing **FAQItem** — if the build
adds either, they land in the §8.2/§8.2b matrices annotated as iteration-1
additions.

**Stage 0 icon set — extension (2026-07-16).** Beyond the pillar glyphs, the
Lucide set includes: `house` / `layout-dashboard` / `target` (or `gauge`) for
the Home / Dashboards / SLOs rail items; `chevron-down` (select & dropdown
triggers, org switcher, TimePicker, facet-group collapse); `chevron-right`
(LogLine accordion expand MI-5, drill-down rows); `x` (QueryPill remove,
drawer/modal close — `x-circle` alone is too heavy inline); `copy` + `check`
(MI-5 copy-path, MI-16 snippet "copied ✓", API-key copy); `more-horizontal`
(WidgetShell ⋯ menu); `flame` (MI-15 burn-rate; SLOCard burning variant);
`star` (dashboard favorites); `plus` (create CTAs: monitor, dashboard, rule,
API key, declare incident); `trash-2` (revoke/delete keys, widgets, rules);
`grip-vertical` (widget drag handle, MI-11); `maximize-2` (widget fullscreen,
MI-12); `download` / `upload` (dashboard JSON export/import); `mail` +
`webhook` (alert channel cards); `key` (API keys & ingestion tokens screen);
`users` (members/roles, org menu); `external-link` (repo/runbook + docs
links); `trending-up` / `trending-down` (QueryValue delta chips); `calendar`
(TimePicker absolute range); `bell-off` (monitor mute, mute windows);
`pencil` (widget/rule edit); `keyboard` (MI-17 cheatsheet affordance,
optional). **Added 2026-07-18** — the WidgetTypePicker tiles (§8.2b) add
four glyphs, named per the naming standard below: `icon/table` (table
widget), `icon/grid-3x3` (heatmap), `icon/share-2` (service map),
`icon/type` (markdown). **NavRail item icons [Adjudicated 2026-07-20]** —
the twelve rail items carry ONE reconciled glyph list (master 284:2 vs
code; the master's glyph wins where it is in this ratified set, code's
stays where it isn't): `house` (Home) · `layout-dashboard` (Dashboards) ·
`bar-chart-3` (Metrics) · `file-text` (Logs) · `route` (Traces — the
APM/Traces pillar glyph; the rail master's git-branch is unratified and
code's activity is vacated to Synthetics) · `globe` (RUM / Analytics) ·
`activity` (Synthetics / Uptime) · `bell` (Monitors) · `flame` (Incidents —
code-side keep; alert-triangle is unratified) · `target` (SLOs) ·
`book-open` (Service Catalog — code-side keep; layers is unratified) ·
`settings` (Settings). **Brand glyphs** — the Google 'G' for the X-1 auth CTA, the GitHub
mark, Discord, Slack — are approved additions per the shared-foundations
iconography rule (§2), **not Lucide**. All four stay on the approved list:
Google 'G' and GitHub are built; Discord and Slack are in build now
(2026-07-17), not deferred.

**Naming standard [Decided 2026-07-17]** — canonical across the ecosystem,
recorded here since the file never stated it: component sets are
**PascalCase**; variant property names are **lowercase**; icons are named
`icon/<lucide-slug>` (e.g. `icon/chevron-down`); brand glyphs are
`icon/brand-<name>` (`icon/brand-google`, `icon/brand-github`). The single
auth CTA component is named **GoogleAuthButton** in every product (§8.2b).

**Canvas hygiene [Directive 2026-07-18]** — design canvases carry **product
copy only**: spec annotations (MI references, requirement IDs,
implementation notes) live in component descriptions and in these docs,
never on screens. A screen frame must read as the shipped product would.

### 8.2 Variant matrices

> **Theme note [Decided 2026-07-17]:** "every component ships both themes"
> (and any "theme ×2" phrasing) is satisfied by the `upstat/tokens` true
> Light/Dark variable modes — components carry **no** theme variant axis;
> dark/light QA runs on the preview frames. The first six rows below were
> added 2026-07-17: as-built contracts for Stage-1 atoms that shipped
> without one.

| Component | Variants × states |
| --- | --- |
| Button | kind: brand / quiet / destructive × state: default / hover / disabled — destructive labels raw `#FFFFFF` per the §2 `on-crit` decision |
| Input | state: default / focus / error / disabled |
| Toast | kind: info / success / error |
| QueryPill | state: default / hover |
| LevelChip | level ×5 — mapping **[Decided 2026-07-16]**: INFO → `brand` · DEBUG → `text-2` · TRACE → `nodata` (ERROR/WARN keep `crit`/`warn`); extracted from LogLine's level chip |
| FacetGroup | expanded / collapsed — the §3 FacetSidebar group ships as the set **FacetGroup** (naming recorded) |
| StatusPill | ok / warn / crit (breathing) / nodata / paused / pending · dot+label / dot-only — **[Decided 2026-07-16]** paused → `nodata` tint · pending → `text-2` |
| TimePicker | preset selected ×6 / custom range open / live (pulsing dot) — built ×3; remaining preset cells covered via instance overrides **[Decided 2026-07-16]** |
| QueryBar | empty / pills / autocomplete open / syntax-error (red underline + hint) |
| TimeseriesPanel | line / area / bars · with/without legend · loading (axis-first) / empty (radar sweep MI-16) / crosshair active — built ×9; the full mode × legend × state matrix is covered via instance overrides **[Decided 2026-07-16]** — **as built (2026-07-18 QA loop):** the bar variants inset their plots clear of the axis labels (bars no longer overlap the axis text) |
| UptimeCard | all-up / with-outage-bars / nodata-gaps · % footer |
| LogLine | collapsed / expanded (JSON tree) / level ×5 tints — level chip mapping **[Decided 2026-07-16]**: INFO → `brand` · DEBUG → `text-2` · TRACE → `nodata` (ERROR/WARN keep `crit`/`warn`) |
| MonitorRow | status ×6 · muted toggle on/off — rows lead with the FULL labeled StatusPill; dot-only is reserved for the §5 colorblind rendering **[Adjudicated 2026-07-20]** |
| IncidentBanner | sev1 / sev2 (persistent) · resolved (transient) — **[Adjudicated 2026-07-20, hybrid]** placement stays the GLOBAL chrome strip under the TopBar (§3); the strip carries the master's (48:141) explicit affordances: "open 12m"-style age and the "View incident →" / resolved "Postmortem →" link text |
| SLOCard | healthy / burning (flame — §8.1 ratifies `flame` for burn-rate; the master's zap glyph is the design-side fix) / exhausted · per-state captions **[Adjudicated 2026-07-20]**: healthy "error budget N% left · burn X.X×" · burning "burn rate X.X× — page on-call" · exhausted "budget exhausted Nd ago" |
| WidgetShell | view / edit (drag handle) / fullscreen — **as built (2026-07-18):** the edit-state body is the real "Choose a visualization" picker strip (WidgetTypePicker `layout=row`, §8.2b), not placeholder art — **as built (2026-07-18 QA loop):** the view-mode master carries a real chart body too (no placeholder in either state) |
| ServiceMapNode | healthy / erroring (ring %) / selected |
| Alert forms | channel: webhook / email · unverified / verified / degraded — **[Adjudicated 2026-07-20]** the channel card leads with a friendly name over the masked target (webhook URLs keep origin + first path segment, the rest truncates); health is a labeled StatusPill (VERIFIED / UNVERIFIED / DEGRADED) with the degraded failure caption beneath |
| AlertRuleCard | type: metric-threshold / log-pattern / trace-latency / slo-burn · mono query summary + threshold line (pages.md B "alert rules") |
| TraceWaterfall | span row: depth indent ×3 · service color (series/n) · status ok/error · default / hover (mini-summary) / selected · chrome: time-axis header + SpanDrawer (tabs: tags / logs-in-span / process) — MI-7, pages.md B5 — **as built (2026-07-17):** SpanRow set + SpanDrawer set + a TraceWaterfall exemplar single (chrome assembled once, not a variant set) |
| QueryValue | big tabular value + delta chip · threshold tint: none / ok / warn / crit · with/without sparkline (dashboard "query value" widget) |
| TopList | ranked horizontal bars ×5 (series palette) + right-aligned values · loading / empty (dashboard "top list" widget) |
| Table | header + rows, numeric right-aligned mono · compact density (dashboard "table" widget) — **as built (2026-07-17):** exemplar single, not a variant set |
| Heatmap | time×bucket cell grid, intensity ramp on series/1 · hover cell tooltip (dashboard "heatmap" widget) |
| LogHistogram | level-stacked volume bars over time axis · hover count tooltip (logs explorer header, pages.md B4) |
| StatusPageHeader | overall: operational / degraded / partial_outage / major_outage · last-updated ts (public status page, pages.md B7) |
| StatusPageComponentRow | component name + StatusPill + 90-day bar strip + uptime % (UptimeCard technique, public view) |
| SyntheticStepRow | kind: http / assertion / wait · drag grip · step index · kind chip (Mono/Micro 10) · summary (Mono/Data 13) · delete — the B7 multi-step builder list; add via the quiet "Add step" button **[Designed 2026-07-20]** |
| StepResultRow | result: pass / fail · step index · StatusPill ("PASS" ok / "FAIL" crit) · summary · duration bar (brand fill, crit on fail; width ∝ duration) · fixed-precision ms — the B7 run timeline **[Designed 2026-07-20]** |
| StatusPageBuilderRow | drag grip · component name (inline rename) · monitor-mapping Select · delete — row order = public page order; output is the `/status/{slug}` construction **[Designed 2026-07-20]** |
| LogPatternRow | expand chevron · count · 7-bucket trend sparkline · Mono template with `<placeholders>` · right-aligned LevelChip (dominant level) · expands to indented sample LogLines — the B4 "Patterns" tab **[Designed 2026-07-20; reconciled 2026-07-20 — single master, LevelChip right-aligned]** |
| UsageMeterRow | pillar measure · MTD value · MTD bar (scaled to each pillar's trailing-3-month peak — the §8.2b contract; per-row widths ship as detached exemplars on the B12 usage frame) · plan column verbatim "Self-host: unlimited · Cloud: announced at GA" (accuracy canon) **[Designed 2026-07-20; reconciled 2026-07-20]** |
| FunnelStageCard | stage label · count (PageTitle/20) · % of previous stage · stages chain with "→" connectors — the B6 drill-down funnel **[Designed 2026-07-20]** |
| IncidentHistoryEntry | phase: investigating / identified / monitoring / resolved · timestamped update list (status page history + incident timeline) |
| SettingsRow | label + description + control slot: text / select / toggle · default / disabled (panes of the route-backed settings tabs **[Ratified 2026-07-20]**; org timezone IANA selector per X-10) |
| EmptyState | per-pillar MI-16 (snippet + radar + docs link) ×4 minimum — **as built (2026-07-18 QA loop):** the traces variant is widened to 660 so the single-line OTLP export snippet fits copy-paste-safe (no line continuation) |

Remaining pages.md widget types compose existing sets inside `WidgetShell`
(log stream = LogLine list · SLO = SLOCard · status = StatusPill grid ·
service map = ServiceMapNode cluster · trace latency = TimeseriesPanel ·
markdown = text) — no separate components needed.

### 8.2b Completion pass (2026-07-16)

Parity audit of pages.md / features.md / flows against the built inventory
surfaced these missing contracts. Same rules as §8.2: dark theme primary,
every component ships both themes (per the §8.2 theme note — via token
modes, no theme variant axis). Blocking for Stage-4 assembly: NavRail,
TopBar, Select/DropdownMenu, APIKeyRow/PropertyKeyRow; blocking for Stage 5:
PillarCard, CodeSnippet + Tabs — the rest rank important or nice-to-have in
build-order terms.

Reconciliation (2026-07-17): ServiceCatalogRow, ErrorGroupRow, TraceMinimap,
and CloudVsSelfHostTable remain **live contracts — in build now**, not
deferred; likewise the Discord and Slack brand glyphs (§8.1). As-built
annotations on individual rows below record where the shipped shape
intentionally differs from the original row text. One copy-accuracy note
spanning rows (2026-07-18): wherever the marketing components mention the
project license, the copy reads **MIT**.

| Component | Variants × states |
| --- | --- |
| **App chrome** | |
| BrandMark | glyph-only / glyph + lowercase `upstat` wordmark — the ONE product mark (filled bolt, brand green) **[Adjudicated 2026-07-20, systemic]**: it renders at every brand site — NavRail head, /signin (124:6), the public status page header (132:3530), marketing nav and footer brand block; the green "U" tile is retired everywhere |
| NavRail / NavRailItem | pillar icon ×12 · item: default / hover (flyout label) / active (brand accent) · rail chrome 56px: flyout-open / collapsed — **as built (2026-07-17):** NavRailItem is the variant set; NavRail ships as a single chrome component with rail states documented in its description — **[Directive 2026-07-19]:** rail is expandable; NavRail is now a variant set `state=collapsed` (56px) / `state=expanded` (240px icon+label rows, pillar section groups, foot chevron toggle, `upstat` wordmark); NavRailItem gains a `layout=rail/expanded` axis (expanded row 228px: default / hover raised bg / active accent bar); toggle persists per user, default expanded ≥1280px; exemplar `B1 — Home (rail expanded)` — **[Adjudicated 2026-07-20]:** Home AND Dashboards sit ungrouped above the TELEMETRY group; the foot is a bordered chevron-square toggle + the signed-in user's avatar (no text button); the head is the bolt brand mark + `upstat` wordmark; item labels keep the fuller product names (RUM / Analytics · Synthetics / Uptime · Service Catalog); item icons per the §8.1 rail-icon list |
| TopBar | org/env switcher closed/open · global TimePicker slot · search (`/`) field · bell: idle / unread-badge / flash (MI-14) — **as built (2026-07-17):** single chrome component, switcher/bell states documented in its description; bell badge states are CountBadge instances — **[Directive 2026-07-19]:** utility cluster now search · ThemeToggle · bell (theme parity canon); the master's flex spacer right-pins the cluster at any instance width — **[Adjudicated 2026-07-20]:** code matches the master's 43px bar height, lowercase `prod` env chip, "Search" placeholder (no ellipsis) and the TimePicker's "Custom" / "● LIVE" casing (the calendar glyph survives only as the <md collapse affordance) |
| ThemeToggle | theme: dark (moon) / light (sun) / system (lucide `icon/monitor`) — 26px hairline button, the variant shows the state you are ON, token-bound · cycle order light → dark → system; system follows live `prefers-color-scheme` · lives on the marketing nav AND the TopBar utility cluster (parity canon) · persists at localStorage `upstat.theme`, default dark when unset — **[Revised 2026-07-20]** |
| Modal / Sheet | modal sm/lg · right sheet · header + body slot + footer actions · z `sheet/modal 40` (§2 layers) |
| CommandPalette / SearchOverlay | empty / results / no-results · result row: icon + label + kbd hint (`/` search, MI-17) |
| **Primitives** | |
| Select / DropdownMenu | trigger: default / open / disabled · menu item: default / hover / selected · type-ahead variant for long lists (IANA timezones per X-10) — **as built (2026-07-17):** trigger ×4 (closed / open / open-typeahead / disabled); menu-item states are baked into the open frame, not a separate item set — **fixed (2026-07-18):** the master's inner row is set to FILL, so the chevron stays right-pinned at any instance width |
| Switch (standalone) | on / off × default / hover / disabled — today baked into MonitorRow/SettingsRow only — hover states in build now (2026-07-17); the contract stands |
| Checkbox (standalone) | checked / unchecked / indeterminate × default / disabled — facet checkboxes stay baked into FacetSidebar |
| Tooltip | placement top/bottom · text-only / multi-metric rows (throughput · error · latency — service-map edges, uptime bars) |
| Avatar / AvatarStack | 20 / 24px · image / initials fallback · stack ×2–5 + "+n" overflow — image variant in build now (2026-07-17) with a neutral placeholder; real photos land at screen time |
| KbdChip + ShortcutCheatsheet | single key / chord (`g d`) · both themes · cheatsheet: 2-col grid overlay (`?`, MI-17) — **as built (2026-07-17):** the cheatsheet is an exemplar single (grid assembled once, not a variant set) |
| CountBadge / BufferedCountChip | bell unread dot+n / buffered "▼ n new" pill (MI-4) · idle / pulse-on-increment |
| SevChip (standalone) | sev1 / sev2 / sev3 — extracted from IncidentBanner for timeline/composer/feed reuse |
| GoogleAuthButton | default / hover / loading · Google 'G' glyph + "Continue with Google" — the product's single auth CTA (X-1); renamed from `GoogleSignInCTA` 2026-07-17 per the §8.1 naming standard (same name in every product) |
| Skeleton | kind: line / value / panel-axis · shimmer sweep — static (no sweep) under `prefers-reduced-motion` per §5 — the Stage-4 loading-frame primitive (§8.1 three-frame rule); iteration-1 addition **[built 2026-07-18]** |
| **Product rows & overlays** | |
| APIKeyRow / PropertyKeyRow | kind: ingestion-token (per-pillar scope chips) / property-key (RUM) · active / rotation-grace (24h) / revoked · mono key + copy + rejection-counter cell — **[Adjudicated 2026-07-20]** entity status is a labeled StatusPill (ACTIVE ok / ROTATING warn / REVOKED nodata), never lowercase text; the anatomy is key icon · name · masked-key chip · per-signal scope chips (otlp → logs/metrics/traces · rum · statsd → metrics · all) · "grace ends in 24h" / "N rejects (24h)" meta · pill |
| MemberRow | avatar + name + email · role select: owner / admin / member · active / invited / disabled |
| DashboardListRow | favorite star on/off · org-shared indicator · default / hover · name + updated ts |
| SavedViewChip | personal / org-shared (avatar stack) · default / active (MI-18) |
| AlertFeedRow + NotificationPopover | sev tint: sev1 / sev2 / resolved — **[Decided 2026-07-17]** the third tint is `resolved`, not sev3 (as built; standalone SevChip keeps sev1–3) · unread / read · 300ms slide-in (MI-14) · popover: empty / list — **[Adjudicated 2026-07-20]** the row is the master's single line (94:1513): unread brand dot · tinted mono sev chip (SEV-1 / SEV-2 / OK) · monitor name · relative age; the message detail rides the row tooltip |
| IncidentComposer | idle / typing / slash-command autocomplete open (`/status`, `/sev`) / posting (optimistic prepend, MI-10) |
| ThresholdOverlay | warn band / crit band / would-have-fired marker — composes over TimeseriesPanel (MI-9 test replay) — **as built (2026-07-17):** exemplar single, not a variant set |
| ServiceCatalogRow | telemetry presence dots per pillar (present/absent ×4) · owner + repo/runbook links · default / hover |
| ErrorGroupRow | fingerprint msg (mono) + count + sparkline + last-seen · new / ongoing / regressed |
| **Wave B rows (designed 2026-07-20)** | |
| SyntheticStepRow | kind: http / assertion / wait · drag grip + step index + kind chip (Mono/Micro 10) + summary (Mono/Data 13) + delete — the B7 multi-step check builder row; add via quiet "Add step" |
| StepResultRow | result: pass / fail · step index + StatusPill ("PASS"/"FAIL") + summary + duration bar (brand; crit on fail; width ∝ duration) + fixed-precision duration — the B7 run-view timeline row |
| StatusPageBuilderRow | drag grip + component name (inline rename) + monitor-mapping Select + delete · row order = public page order — the B7 status-page builder row; output is the existing /status/{slug} construction |
| LogPatternRow | expand chevron + count (tnum) + 7-bucket trend sparkline + template with `<placeholders>` + dominant-level meta · expands to sample LogLine rows — the B4 Patterns tab row |
| UsageMeterRow | pillar + unit label + MTD value (tnum) + bar vs trailing-3-month peak + plan column ("Self-host: unlimited · Cloud: announced at GA" — accuracy canon, no invented quotas/pricing) — B12 usage |
| FunnelStageCard | stage label + count (PageTitle/20 tnum) + share-of-previous meta · stages compose with "→ n%" connectors — B6 RUM drill-down funnel |
| ZoomStackChip | depth ×n label · default / hover (reset affordance) — MI-3 zoom breadcrumb; a QueryPill re-skin is acceptable |
| TraceMinimap | default / span-service highlight (series color) — MI-7 |
| WidgetTypeCell | state: default / selected · icon + label tile, one per widget type — iteration-1 addition **[built 2026-07-18]** |
| WidgetTypePicker | layout: row (the in-shell "Choose a visualization" strip) / grid (create-flow modal overlay, pages.md B2) · 11 widget types (the pages.md B2 list) · composes WidgetTypeCell — iteration-1 addition **[built 2026-07-18]** |
| **Marketing (Stage 5)** | |
| MarketingNav + PillarDropdown | default / pillar-dropdown open (mini feature map ×8, reuses PillarCard) · 4 text links pinned to the parity canon: Features · Platform (anchors to the landing pillar grid) · Docs · GitHub — the GitHub item renders as a compact star badge (GitHubMark 14 + star glyph 12 + neutral "Star" label — no count, no invented figure; the pages.md A13 live star count is runtime behavior; construction adjudicated fleet-wide 2026-07-20) · ThemeToggle · "Sign in" text link (`/signin`) + "Try Cloud" brand CTA **[Revised 2026-07-19]** — **as built (2026-07-20):** the dropdown ships as `FeaturesDropdown` (hover/chevron-click disclosure, chevron flips ▴ while open, Escape/focus-out close, rows deep-link `/#pillar-n`); the Features link keeps `/#features` |
| MarketingFooter | brand block (wordmark + tagline) + 4 pinned columns Product / Docs / Community / Legal (4·4·4·3 links, parity canon) + legal bar verbatim "© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT License." · language selector (English-only pre-i18n) · security-policy affordance — **[Directive 2026-07-19]** |
| PillarCard | pillar ×8 (icon + pillar color accent) · default / hover (lift + accent) |
| CodeSnippet + Tabs | tab: Go / Python / Node / k8s / docker / helm (active/inactive) · copy: idle / copied-check · mono block on `bg-elev` — **as built (2026-07-17):** the tab axis is the variant set; copy idle/copied-check is handled via instance overrides, not a variant dimension · `tab=docker/helm` is the A14 self-host pair: mirrored two-line commands (only the final command differs: `docker compose up --build -d` vs `helm install upstat deploy/helm`) with a muted MONGO_URI caption under the block in the section, tab-independent **[Ratified 2026-07-20]** |
| CloudVsSelfHostTable | 2 plan columns × feature rows (check / dash) · per-column CTA footer — **as built (2026-07-18):** carries a "Managed upgrades & backups" row; no invented SLA figures |
| FAQItem | state: expanded / collapsed · 720w accordion, single-open (pages.md A15 FAQ) — iteration-1 addition **[built 2026-07-18]** |

### 8.3 Design-prep needed from content

Synthetic telemetry series (realistic p50/p95 shapes, an outage window, a
flapping window) for honest-looking panels; log fixture lines; the 90-day
uptime strip data pattern.

### 8.4 Prototype

> The clickable prototype over the Stage-4/5 screens. Conventions
> **[Decided 2026-07-18]**, wired and verified during the 2026-07-18 QA
> loop; later screens wire the same way.

**Flows — named starting points per page.**

- **Dashboard page — flow "Login"**: login → onboarding (create-org →
  send-your-first-data) → B1 Home → all pillars via the NavRail, plus the
  create flows (dashboard, monitor, RUM property, declare-incident) and the
  detail drill-ins (APM service detail, monitor detail, …).
- **Home page — landing flow**: hero and nav CTAs wired **cross-page** to
  the Dashboard "Login" flow (move-wire-restore, below); "Read more" links
  are `SCROLL_TO` anchors within the page.
- The **public status page is deliberately OUT of the in-app flow**: it is
  a public URL surface (`status.upstat.cuesoft.io/{slug}`, pages.md B7)
  with no in-app affordance by design — a separate entry point, not a dead
  end.

**Wiring conventions.**

- Interactions are `ON_CLICK` → `NAVIGATE`.
- Transitions: `DISSOLVE` ~150–200ms for nav/tab switches; `SMART_ANIMATE`
  for pushes/backs (drill-in / drill-out pairs); `AFTER_TIMEOUT` for async
  verification states (e.g. waiting-for-data resolving to populated).
- Empty, loading, QA, and index frames stay **out** of the flow by design —
  the prototype walks the populated product; the three-frame rule's (§8.1)
  empty/loading frames are documentation states, not stops.

**Reachability.** Verified by BFS over the reaction graph from each flow
start: every wired frame reachable, no dead ends besides intended
terminals (§1's "dead-end views are defects" extends to the prototype).

**Cross-page links — move-wire-restore.** The Figma API rejects creating a
cross-page `NAVIGATE` reaction directly, but reactions persist if the
source frame is temporarily moved to the destination page, wired there,
and moved back — the recorded technique behind the Home → Login CTAs.
