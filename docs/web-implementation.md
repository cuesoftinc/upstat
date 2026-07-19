# Upstat — Web Implementation Standard

> How `web/` gets rebuilt: the **CueLABS™ Web Implementation Standard**
> (ratified 2026-07-18, org-wide **[Directive]**) carried in full, plus the
> Upstat-specific addendum — stage plan, token mapping, route map, TEST_MODE
> contract, mock server, test strategy, legacy quarantine policy. Markers as in
> [design.md](design.md): **[Directive]** = user-stated direction,
> **[Proposed]** = ratifiable decision, **[Decided <date>]** = ratified.
> Companion contracts: [engineering.md](engineering.md) (errors, authz,
> limits), [design.md](design.md) (tokens, components, MI catalog),
> [pages.md](pages.md) (screens), [api.md](api.md) +
> [openapi.yaml](api/openapi.yaml) (surface).

## 1. The standard (ecosystem, shared across the three products)

- **Stack**: Next.js 16 App Router + React 19 + TypeScript; Tailwind maps to
  the token CSS variables (§3). All live UI is token/Tailwind-based; the one
  non-UI holdover is the gRPC-Web control-plane client, live per X-8 until
  monitors-v2 (§8).
- **Design tokens**: `web/src/design/tokens.css` — CSS custom properties
  mirroring design.md §2 exactly (light on `:root`, dark on
  `[data-theme="dark"]`, honoring `prefers-color-scheme` with manual
  override; spacing 4–64; radii; durations + easings; z layers; the 8-step
  series palette; `on-brand`). **No raw hex in components** — the same rule
  as Figma (design.md §7); documented exceptions carry a code comment.
- **Components**: `web/src/components/ui/<Name>.tsx` — one module per Figma
  component set, named exactly as the set (PascalCase, design.md §8.1 naming
  standard); props mirror the variant axes (`kind`/`size`/`state`/…);
  microinteractions from design.md §4 implemented with duration/easing
  tokens and `prefers-reduced-motion` fallbacks (design.md §5); each
  component unit-tested.
- **MVC**: models = `web/src/models/` (typed entities per
  [data-model.md](data-model.md) + repositories per
  [api.md](api.md)/[openapi.yaml](api/openapi.yaml) — the **only** layer
  that talks to the network); controllers = `web/src/controllers/`
  (feature-scoped hooks/orchestration, own all state; views never fetch);
  views = `web/src/app/**` routes + composed components, render-only.
- **TEST_MODE**: `NEXT_PUBLIC_TEST_MODE=1` → GoogleAuthButton navigates
  straight to the dashboard (no Firebase), and the API client targets the
  in-app mock server (§5). Auth sits behind an `AuthProvider` interface
  (`TestModeAuthProvider` now; `FirebaseAuthProvider` added at
  backend-integration time — X-1 Google-only either way,
  [flows/auth.md](flows/auth.md)).
- **Mock server**: Next route handlers under `web/src/app/api/mock/*`
  implementing the documented API surface the web needs (paths, snake_case
  error codes, and taxonomies from api.md/openapi.yaml), backed by a seeded
  in-memory store with full CRUD (dev-persistent via a module singleton);
  seed data = the docs-coherent Figma dataset (§6) so the app boots looking
  like the designs. Contract types shared with models.
- **Tests**: Vitest + Testing Library for unit/integration (components,
  controllers, mock handlers); Playwright e2e mirroring the design.md §8.4
  prototype flows, run in TEST_MODE against the mock server; both wired
  into CI build+test (UX-5; X-6: merge-to-main never deploys).
- **Legacy / dead-code policy**: before replacement, legacy trees are
  `git mv`-ed into `web/src/legacy/` (structure preserved, excluded from
  build & routing) — live paths carry zero dead code; after the replacement
  passes QA + Playwright, the legacy subtree is deleted in a dedicated
  `chore(web): retire legacy <area>` PR. No dead code outside `src/legacy/`,
  ever; `src/legacy/` itself trends to empty. Upstat's application of the
  policy: §8.
- **Process**: stages W0 → W3 (§2), PR per stage; conventional commits; QA
  loops evaluate the implementation against the Figma file (tokens,
  geometry, states, interactions) before a stage closes; docs + the org
  SKILL.md updated with every deviation.
- **Component reuse policy [Decided 2026-07-18]**: pixel-fidelity to the
  Figma file wins. All **visual** components are built in-house from the
  token layer — no styled component kits in new code (no MUI, no
  shadcn/DaisyUI skins) and **no chart libraries** — a rule with teeth here,
  since charts are Upstat's product: TimeseriesPanel, LogHistogram, Heatmap,
  TopList, UptimeCard strips, sparklines, the TraceWaterfall time axis, and
  the ServiceMap are bespoke SVG built to the Figma chart specs.
  Reuse is allowed only where it is invisible: headless behavior primitives
  (Radix/Base UI class — dialog, popover, select, tabs, switch, checkbox,
  tooltip, accordion semantics with focus traps, keyboard nav, ARIA),
  positioning engines (Floating UI), `lucide-react` (the design system's
  own icon set, design.md §2 — matches by construction; brand glyphs — the
  Google 'G', GitHub, Discord, Slack — as local SVGs per the §8.1 icon
  note), and math/format utilities (d3-scale, date-fns, clsx; `d3-force`
  qualifies as invisible layout math for the B5 service map — the rendering
  stays bespoke SVG). Fidelity is verified against the Figma file in the
  stage QA loops (screenshot comparison + token/geometry checks).

## 2. Stage plan — W0 foundations → W3 dashboards

One PR per stage; a stage closes only after its QA loop against the Figma
file passes (screenshot comparison + token/geometry/state checks against the
Style Guide, component sets, and screen frames — the same standard as the
design-phase QA loops, design.md §8).

| Stage | Scope | Closes when |
| --- | --- | --- |
| **W0 Foundations** | `tokens.css` (§3) + Tailwind mapping · Inter/JetBrains Mono via `next/font` + the §2 type ramp in the Tailwind theme · MVC skeleton (`models/`, `controllers/`, `components/ui/`) · `AuthProvider` interface + `TestModeAuthProvider` · new `/signin` (single GoogleAuthButton screen; the ONLY auth route per the route standard, X-1) · mock server + seed dataset (§5–6) · Vitest + Playwright harnesses wired into CI build+test (UX-5) | tokens render both themes correctly vs the Style Guide page (dark default); TEST_MODE boots to a stubbed `/dashboard` against the mock server; `/signup` gone from routing (flows/auth.md); CI green |
| **W1 Components** | `components/ui/*` per the design.md §8.1 build order (Stage 1 atoms → Stage 2 molecules → Stage 3 panels/chrome) and the §8.2/§8.2b contract rows — the bespoke-SVG chart set included · MI specs MI-1…MI-18 · unit tests per component. The §8.2b Marketing (Stage 5) rows land at the top of W2 instead — they have no consumer before it | every built component passes QA vs its Figma component set (variants, states, both themes, motion specs) |
| **W2 Home — DONE (as built 2026-07-19, PR #146)** | Marketing kit (§8.2b Stage-5 rows) · Part A screens (§4): A1–A10 + iteration rows A11–A16 · demo cards on §8.3 synthetic data (U0-3) · live GitHub star fetch at runtime (A1 badge + A13 — no static count, per the as-built MarketingNav note) · dogfood instrumentation: `page_view` per the api.md §3.4 registry row, env-gated until the events layer (Phase 1) is live; CTA-click events are registered in the §3.4 master registry **before** W2 instruments them (registry-first discipline, api.md §3.4a) | QA vs the Stage-5 Figma page; Playwright covers the landing flow (§8.4) incl. the cross-page CTA handoff into the app |
| **W3 Dashboards — DONE (as built 2026-07-19, PR #152)** | Part B routes (§4) under the `/dashboard` IA: NavRail (12 pillars) + TopBar chrome · first-run onboarding (create-org → send-your-first-data, MI-16) · B1–B12 screens with their create flows (dashboard + widget picker, monitor type-picker → rule editor, RUM property, declare-incident modal) and drill-ins · public status page route · feature controllers per pillar | QA vs the Stage-4 Figma frames + §8.4 prototype flows; Playwright covers the §8.4 "Login" journey (§7) |

**W2 as-built (2026-07-19, PR #146).** Radix convergence complete — Modal/Sheet,
Tooltip, Select type-ahead, Switch, Checkbox, NotificationPopover, and the
IncidentComposer autocomplete now ride `@radix-ui` primitives (the headless-
primitive allowance, §1); rendered chrome is the W1 Figma-QA'd markup
unchanged and zero visual regression was verified (before/after gallery
screenshots). Landing A1–A16 built from the registry, with six fidelity
fixes found in the closing QA loop against the Stage-5 Figma frame: the
MarketingNav bolt brand mark, TimeseriesPanel's two-line stacked header, the
status-embed banner timestamp + inline component rows, the timeline-variant
IncidentHistoryEntry, the use-case quad panels' query chips, and a 375w
pre-overflow fix with a strengthened e2e overflow guard (checks `html` and
`body`, not `body` alone). The analytics tracker stays hermetic in
TEST_MODE — no events fire under Playwright/CI (api.md §3.4). The public
status page embed is composed from the StatusPageHeader +
StatusPageComponentRow set (§6), not a bespoke embed. Section components are
canon at `web/src/components/home/`.

**W3 as-built (2026-07-19, PR #152).** All twelve NavRail pillars shipped
against the mock server, plus the public `/status/[slug]` page — live-
derived from declared incidents, not a static embed — and first-run
onboarding (create-org → send-your-first-data) backed by a multi-org mock
store. MI coverage closed out: MI-1 URL-synced global time, MI-3 zoom stack
+ breadcrumb chip, MI-4 live tail, MI-2 synced crosshair, MI-11/12 widget
grid editor, MI-10 slash-command incident composer, and MI-18 saved views.
Mock endpoints added: `orgs/{id}/activate`, `rules/{id}/test` +
`monitors/{id}/test` (MI-9 replay), `channels/{id}/verify`, `status/{slug}`,
`views` CRUD, and a `/v1/reset` test seam. The gRPC/proto control-plane
tree stays live per X-8 until monitors-v2 (§8).
`scripts/check-boundaries.mjs` — legacy
quarantine, views-never-fetch, no-raw-hex — is wired into `npm run lint`.
Un-ignoring the registry from ESLint surfaced a stale negation pattern in
the old ignore list (it didn't reach nested files, so the registry had been
silently unlinted); 12 latent errors were fixed once it was linted for
real. The `/dev/components` gallery now carries the apparule pattern's
production guard — `notFound()` when `NODE_ENV=production` and not
TEST_MODE. `Select` moved to the ARIA 1.2 combobox pattern and
`ShortcutCheatsheet` to a semantic `<dl>`. Playwright's §8.4 journey runs
serialized against the shared mock store, reset to a clean seed via
`/v1/reset` at the start of the run for hermetic e2e.

**System-QA as-built (2026-07-19).** Full-system pass over the TEST_MODE
prod build (all journeys + MI spot-checks at 1440/390). Fixes landed:
the app frame is now viewport-bounded (`h-dvh`, was `min-h-screen`) so
`<main>` is the real scroll container — this is what makes MI-4's
scroll-up pause + buffered-count reachable (the logs list previously grew
the body and never overflowed); the home page's demo data seeds from a
pinned epoch on first render and rebuilds with the real clock post-mount
(static prerender + hydration text-mismatch, React #418); mock
`parseQuery` rejects malformed pipes so MI-13's syntax-error state is
reachable; QueryBar autocomplete filters to the typed token before Tab
completion (MI-13); the `?` cheatsheet closes on ESC (MI-17); the status
page publishes the check's own latency figure (`p95_ms` on the status
component read model — it hardcoded 96 ms and disagreed with
`/dashboard/uptime`); RUM buckets at 5m for short ranges (the 1h default
rendered as a single bar + one-column vitals heatmap); the seeded
dashboard wires `$service`/`$env` into widget queries and carries a
second timeseries widget so the template-var bar governs something real
and MI-2 cross-widget crosshair sync is observable; TimeseriesPanel
legends label grouped series by their distinguishing tag suffix (full
name on the title tooltip).

**Expandable NavRail as-built (2026-07-19, [Directive] design.md §2).**
Collapsed 56px icon rail (hover flyouts) ⇄ expanded 240px icon+label rows
under the Telemetry/Respond/Platform section groups (B-order preserved;
Home ungrouped at top). Foot chevron toggles (`aria-expanded`, focusable);
the choice persists as `nav.rail.expanded` in localStorage; default is
expanded ≥1280px, collapsed below, resolved after mount so SSR stays
deterministic (server renders collapsed). NavRailItem gains an `expanded`
prop (default false — existing call sites untouched); active items carry
the brand accent bar + brand icon in both states. Content reflows via
flex (`<main>` is `flex-1`); every pillar screen verified at both rail
widths, `e2e/navrail.spec.ts` covers toggle + persistence + viewport
defaults.

**Nav/footer parity + theme toggle as-built (2026-07-19, SKILL.md
"Marketing nav, footer & theme parity canon").** MarketingNav carries the
canonical shape — Features(/#features) · Platform(/#pillars) ·
Docs(GitBook root) · GitHub star badge (live runtime count, never
static) + ThemeToggle + Sign in link + Try Cloud CTA. MarketingFooter owns the
canonical column set (Product / Docs / Community / Legal, ratified URLs)
plus the legal bar: verbatim "© Cuesoft Inc. 2026. Upstat. CueLABS™
Division. MIT License." with linked marks, an English-only language
selector (real control, no i18n yet — ratified) and the SECURITY.md
affordance. Theme: apparule's ThemeProvider contract ported to
`web/src/design/ThemeProvider.tsx` — `data-theme` on `<html>`,
localStorage key `upstat.theme`, default = the design default (dark,
attribute-less) when unset, pre-paint init script in the root layout;
ThemeToggle lives in the marketing nav, the dashboard TopBar utility area
and Settings ("Appearance"). Playwright asserts the canonical hrefs and
the toggle flip/persist on home and dashboard.

**Marketing content pass as-built (2026-07-19, user decisions).** Three
revisions: (1) the nav/footer product slot is **Platform → `/#pillars`**
(the 8-pillar grid) — "Dashboards" pointed a marketing surface at the
auth-gated `/dashboard` app route; nav (desktop + mobile panel) and the
footer Product column carry the same slot. (2) CTA dedupe per the
"Community CTA placement" canon — GitHub/Discord conversion moments live
in exactly three spots (nav star badge · A13 developers section's
GitHub + Discord pair with the #upstat-lab copy · footer Community
column); the former extras now carry differentiated real destinations:
A9 links the query-grammar GitBook page and the product's own live
status page (`/status/upstat`, the dogfood story), A8's card is
CueLABS™ (`cuelabs.cuesoft.io`) with the GitBook roadmap and Self-host
guide beside it. (3) The `/login` 308 stub is deleted (user: "no one
needs those") — stale `/login` links 404 on the branded not-found page;
`/signin` stays the only auth route. Root prose carries the CueLABS™
mark (Makefile/CONTRIBUTING byte-identical to the generator templates).

**Mobile TopBar as-built (2026-07-19).** Below `md` the dashboard TopBar's
fixed-width utility cluster (~770px: org/env + preset TimePicker + w-56
search + toggle + bell) overflowed the clipped document — right-side taps
side-scrolled the chrome itself (probed: the bell panel landed at
x=−302). The cluster now collapses at <md: the org switcher compacts
(name truncates at 96px, env chip hides), the global TimePicker collapses
to its calendar icon-button and its absolute-range dialog becomes a fixed
full-width sheet under the bar (viewport-bounded by construction), search
collapses to an icon button (same CommandPalette trigger; `/` still
works), ThemeToggle and the bell stay as icons. Floating layers keep the
collision clamps from the 2026-07-19 sweep. Playwright (390): no
horizontal document scroll, every TopBar control visible/operable
in-viewport, TimePicker sheet + bell popover + org menu bounding boxes
inside the viewport. Desktop (md+) is untouched.

**Mobile content as-built (2026-07-19).** Beyond the TopBar, every pillar
screen's CONTENT fits the 390 viewport (768 sanity-checked): explorer
facet sidebars (logs, metrics) stack above their streams below `lg`;
stat-tile and card grids start single-column and widen at `sm`/`lg`/`xl`;
the B2 12-col widget grid stacks single-column in reading order below
`md` (drag/resize affordances stay desktop-only — positions are 12-col
coordinates); wide visualizations scroll horizontally *inside* their
panels, never the document — `Table`, the bespoke APM service/endpoint
tables and trace-result rows, `TraceWaterfall` (560px min canvas),
`Heatmap`, `LogHistogram`, the service-map topology (880px min canvas)
and `UptimeCard`'s 90-day strip; `SpanDrawer` becomes a full-width fixed
sheet below `lg`; `Modal`/`Sheet` clamp to the viewport. Two
intrinsic-sizing traps are codified from this pass: percentage
`max-w-full` is ignored during intrinsic width computation (grids need
explicit `grid-cols-1` / `minmax(0,…)` tracks and flex items `min-w-0`
for truncation to actually bound a track), and the UA default
`min-inline-size: min-content` on `<fieldset>` requires `min-w-0`.
`e2e/mobile-responsive.spec.ts` sweeps every §4 route at 390 in both
themes (with screenshots) plus a 768 pass — asserting the document never
side-scrolls, `<main>` never pans, and any element wider than the
viewport sits inside a horizontal-scroll container — and covers the
span-drawer sheet, stacked widget grid + widget editor, and log-line
expansion at 390.

Marketing surfaces in the same pass (user-ratified, 2026-07-19): below
`md` the MarketingNav bar keeps the **Try Cloud** CTA (compact size)
beside the hamburger — always visible, so it is not duplicated in the
disclosure panel, which carries the 4 canonical links + ThemeToggle +
Sign in. MarketingFooter converges to the sibling mobile structure:
brand block + 4 link columns render as ONE responsive grid
(`grid-cols-2 gap-8 md:grid-cols-5`, brand `col-span-2 md:col-span-1` —
full-width brand row at 390, orderly 2-col link columns, one 5-col row
at md+), and the legal bar is `flex flex-wrap justify-between` with the
© line first and the Security + language utilities as one grouped
cluster wrapping beneath it at 390. The root layout carries
`suppressHydrationWarning` on `<html>` (apparule ThemeProvider
contract) — the pre-paint theme script sets `data-theme` before React
hydrates.

**Demo realism & UX pass as-built (2026-07-19).** The seeded telemetry now
reads as a real production system under watch: a deterministic
continuous-delivery schedule (one deploy per service every 6h) surfaces as
staged release LOG lines (started → canary → full → finished over ~2min)
and a correlated 45-min post-deploy latency/error blip on that service's
metrics — release events visibly explain chart shifts, while chart deploy
MARKERS stay cut per pages.md B1 (no deploy-events API is implied); every
log line's `version` attr is the service's current version and bumps at
the deploy. Log trace ids are per-line deterministic hexes (~25% of
lines) — only lines inside the hero-trace window on its services carry
the hero id (it previously rode ~30% of ALL lines). Error-group
sparklines cohere with their states (new = appears at first_seen;
regressed = spike aligned to the INC-42 window; ongoing = steady band).
The alert feed matches rule states — the warn-state SLO-burn rule has its
sev2 entry, and the trace-latency rule carries a triggered→recovered pair
matching its `last_triggered_at`; feed timestamps render "MMM d" once an
event is older than today (a bare "16:00" on a 4-day-old event read as
today), UTC-derived like every data surface. UX fixes in the same pass:
QueryBar's syntax-error live region is always-mounted (role=alert on a
conditionally-mounted node is unreliable in screen readers); the RUM
uniques tile reads "unique visitors · daily avg" (analytics-math §4
exact-label rule); `/status/{slug}` 404s on a branded public page (CTA →
home, not the auth-gated app) and the status header no longer advertises
the not-yet-built subscribe affordance; query-value widgets no longer
repeat their title inside the body (WidgetShell owns the title);
WidgetShell clips fixed-height cells cleanly and the seeded p95 widget is
one row taller so its 7-service legend renders unclipped; SpanDrawer
dismisses on ESC and, below `lg`, on backdrop tap. Token hygiene: signin
brand-mark type joins the §2 ramp (16px), BufferedCountChip uses
`rounded-full`.

**Demo completeness as-built (2026-07-19).** Gap-diff of pages.md /
features.md against the implementation, closed in one pass: **B2 portable
JSON** — dashboards export a versioned portable definition (ids stripped;
`Export JSON` on the view downloads it) and import one (`Import JSON` on
the list validates version/name/widget types/layout and lands on the new
dashboard); **B6** devices + countries breakdowns render (the summary
generated both, unrendered); **B5 logs-in-span** — the span drawer's logs
tab carries the trace-correlated lines (a controller fetches the trace
window and keeps `trace_id` matches; per-span filtering by service + a
±1.5s window matching the stream's correlation skew); **B9
declare-from-alert** — active rows in the monitors Triggered feed open the
declare-incident modal prefilled (title from the alert, sev mapped), via
the extracted shared `DeclareIncidentModal`; **A1/A-footer nav anchors
differentiated** — Features → `/#features` (the A11 feature-highlights
band), Platform → `/#pillars`. Adjudicated Figma-parity restyles landed
with the design-side updates: FAQItem → product radius + 4px-grid padding;
StatusPill → 4px-grid padding. **Expanded-rail reflow ([Directive
2026-07-19] + mobile clarification)**: with the 240px rail, every
dashboard route reflows cleanly at 1280/1440 (e2e sweep asserts no
document side-scroll and no element outside a scroll container, both
widths, rail expanded); below `md` rail expansion renders as a 240px
**overlay drawer** over a scrim — content keeps full width, the persisted
desktop state does not apply (mobile boots collapsed), scrim/Escape/item
selection dismiss (`e2e/navrail.spec.ts`). Known spec gap deliberately
deferred: the A1 Features pillar-map dropdown (pending adjudication
against the 4-text-links parity canon).

**Code-quality pass as-built (2026-07-19).** The documented dead-dependency
prune landed: `styled-components` (+ its `next.config.ts` compiler flag),
`chart.js`, `react-chartjs-2`, `recharts`, `@tanstack/react-query`,
`js-cookie` (+ `@types/js-cookie`), `@iconify/react`,
`@react-oauth/google`, and `@floating-ui/react-dom` are removed — zero
live imports verified first; the X-8 gRPC control-plane pair
(`grpc-web`, `google-protobuf` + `src/proto`/`src/client.ts`/
`components/libs/grpc`) stays until monitors-v2 per §8. Dead code:
MarketingFooter's unused `inline` variant axis removed (no consumer; the
footer renders the one canonical stacked shape). The docs now describe
only the current system (api.md §2 states the HTTP alert surface without
the struck-through gRPC sketch; stale nav enumerations corrected).
`package.json` scripts carry the org-canonical names and compositions
(`dev/build/start/lint/lint:fix/typecheck/test/test:watch/test:e2e/
check:boundaries`); the web tooling (boundary gate, prettier config,
vitest/playwright/tsconfig shapes, `PW_PORT` port isolation) is converged
with apparule and expendit.

Screen-state parity **[Directive 2026-07-18, carried from design.md §8.1]**:
every data-driven screen ships default, empty, and loading states — the
three-frame rule applies to the implementation exactly as it does to the
Figma templates (EmptyState/MI-16 + first-run copy; Skeleton loading; a
demo-data toggle where the screen's spec calls for one — first application
B1/B2/B4/B5), and the QA loop checks all three.

## 3. Token mapping — design.md §2 → `web/src/design/tokens.css`

One custom property per Figma variable in the `upstat/tokens` collection
(design.md §7). **Dark is the default and lives on `:root`** (design.md
§2: dashboards + marketing default dark); light mode is the manual
override `[data-theme="light"]` set by the theme toggle. Deliberately
**no `prefers-color-scheme` auto-switch** — upstat is dark-primary and
theme is an explicit user choice (a ratified deviation from the sibling
light-`:root` arrangement; the ThemeProvider contract is otherwise
identical).

| Group | Token names (as built in `tokens.css`) |
| --- | --- |
| Color | `--color-bg` · `--color-bg-elev` · `--color-border` · `--color-text` · `--color-text-2` · `--color-brand` · `--color-brand-deep` · `--color-on-brand` · `--color-ok` · `--color-warn` · `--color-crit` · `--color-nodata` (the `--color-` prefix is the Tailwind v4 `@theme` convention; the Figma variables carry the bare names) |
| Series palette | `--color-series-1` … `--color-series-8` — the §2 8-step categorical set, identical both modes; series→color assignment stable per view session |
| Spacing | step-named on the 4px grid: `--space-1: 4px` `--space-2: 8px` `--space-3: 12px` `--space-4: 16px` `--space-6: 24px` `--space-8: 32px` `--space-12: 48px` `--space-16: 64px` — no off-scale values (data views may compress to the 4px sub-grid: 2px hairline gaps in dense tables, §2) |
| Radii | `--radius: 4px` (the product radius — denser than siblings); fully-round pills/dots/avatars use the Tailwind `rounded-full` utility (no separate custom property) |
| Motion | `--duration-fast: 120ms` · `--duration-base: 200ms` · `--duration-slow: 300ms` · `--duration-entrance: 250ms` · `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` · `--ease-exit: cubic-bezier(0.4, 0, 1, 1)` |
| Z layers | `--z-base: 0` · `--z-sticky: 10` · `--z-dropdown: 20` · `--z-overlay: 30` · `--z-modal: 40` (the §2 "sheet/modal 40" layer) · `--z-toast: 50` |

Notes: status semantics are sacred — `ok/warn/crit/nodata` are reserved for
state, never decoration, and `ok` stays visually distinct from `brand`
(design.md §2). `--on-brand` is dark ink in **both** modes and applies to
`brand` fills only — destructive-fill labels stay raw `#FFFFFF` pending a
possible `on-crit` token **[Decided 2026-07-17]**; that raw white is the
canonical example of a documented no-raw-hex exception (code comment
required, §1). Type ramp (11/12/13/14/16/20/24–32) and fonts live in the
Tailwind theme, not tokens.css; tabular numerals
(`font-variant-numeric: tabular-nums`) apply in all numeric contexts —
values, latencies, counts — per the §2 `tnum` rule.

## 4. Route map — pages.md Part A/B → app routes

The new IA mounts at **`/dashboard`** **[Directive 2026-07-18, route
standard]** — `/` home · `/signin` the only auth route · all app surfaces
under `/dashboard/<area>`, canonical across the CueLABS™ products. Rail
order per pages.md Part B.

| pages.md | Route | Screen |
| --- | --- | --- |
| Part A (A1–A16) | `/` | Public home page |
| flows/auth.md · design.md §8.1 Stage 4 | `/signin` | Single auth screen — GoogleAuthButton + legal links (X-1; the only auth route — stale `/login` links 404 on the branded page (stub removed 2026-07-19); there is no `/signup`) |
| B1 | `/dashboard` | Home — org health: incidents banner (MI-14), triggered monitors, SLO burn (MI-15), watched dashboards |
| B1 first-run | `/dashboard/onboarding` | create-org (name + IANA timezone, X-10) → send-your-first-data (ingestion key + snippet + MI-16 waiting-for-data; resolves to `/dashboard` on first datapoint) |
| B2 | `/dashboard/dashboards` · `/dashboard/dashboards/{id}` | List (org-shared, favorites) · grid editor (MI-11/12); create flow = name → widget-picker overlay → edit mode |
| B3 | `/dashboard/metrics` · `/dashboard/metrics/summary` | Metrics explorer (QueryBar + MI-2/3, save-to-dashboard) · metrics catalog/tag explorer |
| B4 | `/dashboard/logs` | Logs explorer — FacetSidebar + QueryBar + virtualized LogLine list + histogram (MI-4/5/6) |
| B5 | `/dashboard/traces` · `/dashboard/traces/services/{service}` · `/dashboard/traces/explorer` · `/dashboard/traces/map` | Service list · service page (endpoints, latency distribution, deps) · trace explorer + TraceWaterfall/span drawer (MI-7) · service map |
| B6 | `/dashboard/rum` · `/dashboard/rum/new` | RUM/analytics (pages, vitals, errors) · property create (key issuance + SDK snippet) |
| B7 | `/dashboard/uptime` · `/dashboard/uptime/{id}` | Uptime checks (the absorbed monitor core) · per-monitor page (90d strip, response-time chart, incidents, insight panel) |
| B7 public | `status.upstat.cuesoft.io/{slug}` → `/status/{slug}` | Public status page — host-based rewrite onto the same app **[Proposed]**; unauthenticated, deliberately outside `/dashboard` (a separate entry point, design.md §8.4) |
| B8 | `/dashboard/monitors` · `/dashboard/monitors/new` · `/dashboard/monitors/{id}` | Monitors list + triggered feed (MI-14) · type picker → rule editor · detail with MI-9 test-replay frame |
| B9 | `/dashboard/incidents` · `/dashboard/incidents/{id}` | Incident feed · timeline composer (MI-10); declare-incident is a modal, not a route |
| B10 | `/dashboard/slos` | SLO list + define (SLI source, target, window) |
| B11 | `/dashboard/services` | Service catalog (telemetry-presence, owner, repo/runbook) |
| B12 | `/dashboard/settings` + sub-screens `/dashboard/settings/members` · `/dashboard/settings/keys` · `/dashboard/settings/properties` · `/dashboard/settings/integrations` · `/dashboard/settings/retention` · `/dashboard/settings/org` | Org/members/roles · API keys & ingestion tokens · property keys · integrations · retention per signal · org profile (IANA timezone, X-10) |

Part C (mobile on-call companion) has no web routes — later phase, out of
W0–W3 (§8). Deep-linkable state rides the query string, not new routes:
every filter/time state has a URL representation (design.md §1 keyboard +
query duality; MI-1 back/forward restore).

## 5. TEST_MODE contract

`NEXT_PUBLIC_TEST_MODE=1` (build-time inlined, like all `NEXT_PUBLIC_*` —
[setup.md](setup.md)) switches exactly two seams; nothing else may branch
on it:

1. **Auth**: the `AuthProvider` resolves to `TestModeAuthProvider` —
   GoogleAuthButton navigates straight to `/dashboard` as the seeded test user
   (§6, owner of the seeded org), no Firebase SDK loaded, no popup. The
   interface is identical to the future `FirebaseAuthProvider` (X-1
   Google-only, bearer-token shape preserved), so backend integration swaps
   the provider, not the views.
2. **API client**: the models layer's base URL targets the in-app mock
   server — `/api/mock/v1/*` mirrors the `/v1/*` surface path-for-path, so
   repositories are identical in both modes except for the base URL.

Unset (or `0`) → real `FirebaseAuthProvider` + `NEXT_PUBLIC_BASE_URL`
(api/common HTTP). The new app consumes **HTTP/JSON only** (U-5/X-8 — no
new gRPC-Web surface); until monitors-v2 lands, the real-backend monitor
path is bridged inside the models seam (§8), never in views. TEST_MODE is
how Playwright runs in CI and how W1–W3 are built before the backend
surfaces exist.

## 6. Mock server & seed narrative

Route handlers under `web/src/app/api/mock/*` implement the HTTP surface
the web consumes — api.md §3 (events/stats), the ratified alert surface
(openapi.yaml), and the §6 observability platform surface — with the
engineering.md envelope
(`{"error": {"code", "message", "details"}}`, snake_case stable codes),
the documented rate-limit codes (`429 rate_limited` + `Retry-After`), and
the flow-spec taxonomies (monitor states, check-error causes, channel
states, incident phases, sev levels). Backed by one seeded in-memory store
(module singleton, dev-persistent) with full CRUD; contract types shared
with `src/models/`. The mock speaks the **monitors-v2 HTTP shape** for the
monitor control plane (X-8) — the new views are HTTP-clean from day one
even while the real backend is still gRPC (§8).

| Group | Mocked endpoints (under `/api/mock/v1`) |
| --- | --- |
| Events (dogfood ingest) | `POST /v1/events` — batch ≤100, mixed-batch `202 {accepted, rejected, rejections:[{index, code}]}` semantics (api.md §3.1) |
| Stats | `GET /v1/stats` — series/totals + `uniques_additive: false`; `422 invalid_period / range_too_large / ts_out_of_range` (api.md §3.3) |
| Query | `POST /v1/query` — shared grammar over the seeded telemetry; scripted invalid queries return position-accurate `400 invalid_query {position, hint}` (query-grammar.md §3) |
| Alert channels & rules | `POST /v1/channels` · `POST /v1/channels/{id}/verify` · `GET /v1/channels-list` · `DELETE /v1/channels/{id}` · `PUT/GET /v1/monitors/{id}/rules` — incl. `channel_unverified`, `verification_expired` (flows/alert.md, openapi.yaml) |
| Monitors (uptime) | CRUD + check history per flows/monitor.md (validation codes `name_taken`, `timeout_gte_interval`, `invalid_target`, `target_not_allowed`) · `POST /v1/monitors/{id}/test` — MI-9 24h replay returning trigger bands + would-have-fired markers · triggered feed (api.md §6) |
| Dashboards | CRUD + portable JSON import/export (B2) |
| Incidents | declare/update/resolve · timeline entries (slash-command results, MI-10) · postmortem attach (api.md §6) |
| SLOs | CRUD + status/burn endpoints (api.md §6) |
| Service catalog | CRUD + telemetry-presence summary (api.md §6) |
| Keys | ingest-key CRUD (per-pillar scopes, quotas, 24h rotation grace) · property keys + origin allowlists + rejection counters (B12, U1-7) |
| Org & members | org profile (name + IANA timezone, X-10) · members/roles per the engineering.md §2 matrix |
| Status page (public) | status-page read by slug — powers `/status/{slug}` unauthenticated (B7; the `GetStatusPage` data shape) |

**Seed narrative — the docs-coherent Figma dataset.** The store seeds the
same mock content the Figma screens render (design.md §8.3 design-prep), so
a TEST_MODE boot looks like the designs:

- **One primary org** (IANA timezone set, X-10) owned by the signed-in test
  user, plus member personas covering the MemberRow states
  (active/invited/disabled) and the engineering.md §2 roles.
- **Monitors in every state** — `up / down / nodata / paused / pending` —
  with 90-day check history containing an outage window, `nodata` gaps
  (gray, excluded from the uptime denominator, flows/monitor.md §3), and a
  flapping window (>6 transitions/30min) so the flapping guard and the
  threshold-vs-recovery asymmetry are visible from seed; check-detail rows
  span the §4 error taxonomy (`timeout`/`dns`/`tls`/…).
- **Synthetic telemetry** with honest p50/p95 shapes (design.md §8.3)
  behind every TimeseriesPanel, QueryValue delta, TopList, and Heatmap;
  log fixture lines across all five levels (the LevelChip mapping) with
  expandable JSON bodies for MI-5 pivots and batched arrivals for MI-4
  live tail; traces with per-service req/s + p50/p95/p99 + error rates, at
  least one deep waterfall (depth ×3, an error span), and a service map
  with an erroring edge.
- **Dashboards** org-shared + favorited, exercising every B2 widget type;
  **alerting** seeded with channels in unverified/verified/degraded states,
  one rule per type (metric-threshold / log-pattern / trace-latency /
  slo-burn), and a triggered feed with sev1/sev2/resolved rows (part
  unread); **one open sev1 incident** (persistent IncidentBanner) whose
  timeline spans investigating → identified → monitoring, plus resolved
  history entries; **SLOs** in healthy / burning / exhausted states.
- **Service catalog** rows with mixed telemetry-presence dots; RUM stats
  (top pages/referrers/devices/geo, vitals) and ErrorGroupRows in
  new/ongoing/regressed states; ingestion tokens in
  active/rotation-grace/revoked states and a property key with nonzero
  rejection counters.
- **The public status page** seeded as slug `upstat` (U0-5) — components,
  90-day strips, incident history.
- **A second, empty org** reachable from the TopBar org switcher — walks
  the B1 first-run onboarding and every pillar's MI-16 empty state without
  wiping the primary seed (the mock resolves waiting-for-data to populated
  on a timer, mirroring the prototype's `AFTER_TIMEOUT` convention).

## 7. Test strategy

| Layer | Tooling | Scope |
| --- | --- | --- |
| Unit | Vitest + Testing Library | every `components/ui/*` module (variant axes, states, both themes, reduced-motion fallbacks — incl. the bespoke SVG charts: scale math, series-color stability, threshold tints); model/repository parsing incl. error-envelope handling; controller hooks |
| Integration | Vitest | mock handlers (envelope + catalog codes, mixed-batch `202` semantics, monitor state-machine legality per the flows/monitor.md §2 transition table, position-accurate `invalid_query`); controller ↔ mock-server flows (MI-10 optimistic prepend + rollback on scripted failure; MI-1/MI-3 URL round-trips) |
| E2E | Playwright, TEST_MODE against the mock server | the design.md §8.4 flows: **"Login"** (login → onboarding → B1 Home → every pillar via the NavRail, the create flows — dashboard, monitor, RUM property, declare-incident — and the drill-ins: APM service detail, monitor detail) and the **landing flow** (Part A scroll + `SCROLL_TO` anchors + the cross-page CTA handoff into "Login"); the **public status page** gets its own spec at `/status/upstat` — it is deliberately outside the in-app flow (§8.4), a separate entry point, not a dead end |
| CI | build-and-test workflow (UX-5) | lint + typecheck + Vitest + Playwright on every PR; X-6: merge-to-main never deploys |

The §8.4 rule that empty/loading/QA frames stay out of the prototype maps
here too: Playwright walks real user paths (the empty-org onboarding path
included); empty/loading states are asserted at unit/integration level
(screen-state parity, §2).

## 8. Legacy quarantine

Live paths carry zero dead code. `web/src/legacy/` is the standing
quarantine mechanism — a dead tree is `git mv`-ed there (structure
preserved; excluded from build, routing, and lint), then deleted in a
dedicated `chore(web): retire legacy <area>` PR once its replacement
passes QA — and it is **currently empty**. The guardrails stay armed:
`scripts/check-boundaries.mjs` (wired into `npm run lint`) and the
ESLint `no-restricted-imports` boundary fail any live import of
`src/legacy/**`. `package.json` carries no unused dependencies — the
only intentional exception is the X-8 gRPC pair below (`grpc-web`,
`google-protobuf`), which backs the kept control-plane tree.

One tree stays live by design: the gRPC-Web control plane. `src/proto/*`,
`src/client.ts`, and the gRPC libs (`components/libs/grpc`) are
monitor/user **control-plane code, not UI** — X-8 keeps the existing
control plane on gRPC until monitors-v2 (OBS-006). At backend-integration
time the monitor repository may wrap the gRPC-Web client *inside* the
models seam (views stay HTTP-shaped, §5); when monitors-v2 flips the
dashboard fully HTTP and Envoy retires from the cloud topology, the
proto tree quarantines and retires in its own PR — synchronized with
the backend migration, not the W stages.

`mobile/` (Part C companion) is untouched by W0–W3 and gets its own
implementation standard — including its own application of the quarantine
policy — when that phase opens.

## 9. Acceptance

- [ ] `tokens.css` matches design.md §2 / the `upstat/tokens` collection
      exactly, both themes, dark default; no raw hex in components (CI
      grep-gated; the destructive-label `#FFFFFF` exception carries its
      code comment)
- [ ] W0–W3 each closed by a Figma QA loop before merge; deviations landed
      in docs + the org SKILL.md
- [ ] TEST_MODE boots to `/dashboard` with the §6 seed rendering the
      Figma-coherent narrative; no Firebase loaded; the empty-org path
      reaches onboarding + MI-16 states
- [ ] Every mocked endpoint speaks the engineering.md envelope with catalog
      codes; monitor transitions in the mock honor the flows/monitor.md §2
      table; contract types shared with models
- [ ] Views contain no fetch calls and no gRPC imports (MVC boundary +
      X-8 cleanliness, enforced by review + lint rule)
- [ ] Playwright §8.4 journeys green in CI; merge-to-main never deploys
      (X-6)
- [ ] No dead code in live paths at any point: `src/legacy/` is the only
      quarantine location and trends to empty (§8); the proto/gRPC
      control plane retires only at monitors-v2
