# Upstat — Web Implementation Standard

> How `web/` gets rebuilt: the **CueLABS Web Implementation Standard**
> (ratified 2026-07-18, org-wide **[Directive]**) carried in full, plus the
> Upstat-specific addendum — stage plan, token mapping, route map, TEST_MODE
> contract, mock server, test strategy, legacy quarantine plan. Markers as in
> [design.md](design.md): **[Directive]** = user-stated direction,
> **[Proposed]** = ratifiable decision, **[Decided <date>]** = ratified.
> Companion contracts: [engineering.md](engineering.md) (errors, authz,
> limits), [design.md](design.md) (tokens, components, MI catalog),
> [pages.md](pages.md) (screens), [api.md](api.md) +
> [openapi.yaml](api/openapi.yaml) (surface).

## 1. The standard (ecosystem, shared across the three products)

- **Stack**: Next.js 16 App Router + React 19 + TypeScript; Tailwind maps to
  the token CSS variables (§3). Upstat's `web/` is **not** greenfield — the
  existing styled-components + chart-library + gRPC-Web tree is the current
  product; new-system components are token/Tailwind-based, and the existing
  tree survives only under the legacy policy (§8) until retired.
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
  the ServiceMap are bespoke SVG built to the Figma chart specs (the
  existing chart-library pages are legacy, retired with their tree, §8).
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
| **W0 Foundations** | `tokens.css` (§3) + Tailwind mapping · Inter/JetBrains Mono via `next/font` + the §2 type ramp in the Tailwind theme · MVC skeleton (`models/`, `controllers/`, `components/ui/`) · `AuthProvider` interface + `TestModeAuthProvider` · new `/signin` (single GoogleAuthButton screen; the ONLY auth route per the route standard) with the legacy login/signup pages quarantined per X-1 (§8) · mock server + seed dataset (§5–6) · Vitest + Playwright harnesses wired into CI build+test (UX-5) | tokens render both themes correctly vs the Style Guide page (dark default); TEST_MODE boots to a stubbed `/dashboard` against the mock server; `/signup` gone from routing (flows/auth.md); CI green |
| **W1 Components** | `components/ui/*` per the design.md §8.1 build order (Stage 1 atoms → Stage 2 molecules → Stage 3 panels/chrome) and the §8.2/§8.2b contract rows — the bespoke-SVG chart set included · MI specs MI-1…MI-18 · unit tests per component. The §8.2b Marketing (Stage 5) rows land at the top of W2 instead — they have no consumer before it | every built component passes QA vs its Figma component set (variants, states, both themes, motion specs) |
| **W2 Home — DONE (as built 2026-07-19, PR #146)** | Marketing kit (§8.2b Stage-5 rows) · Part A screens (§4): A1–A10 + iteration rows A11–A16 · demo cards on §8.3 synthetic data (U0-3) · live GitHub star fetch at runtime (A1 badge + A13 — no static count, per the as-built MarketingNav note) · dogfood instrumentation: `page_view` per the api.md §3.4 registry row, env-gated until the events layer (Phase 1) is live; CTA-click events are registered in the §3.4 master registry **before** W2 instruments them (registry-first discipline, api.md §3.4a) | QA vs the Stage-5 Figma page; Playwright covers the landing flow (§8.4) incl. the cross-page CTA handoff into the app |
| **W3 Dashboards** | Part B routes (§4) under the `/dashboard` IA: NavRail (12 pillars) + TopBar chrome · first-run onboarding (create-org → send-your-first-data, MI-16) · B1–B12 screens with their create flows (dashboard + widget picker, monitor type-picker → rule editor, RUM property, declare-incident modal) and drill-ins · public status page route · feature controllers per pillar · legacy dashboard quarantine on close (§8) | QA vs the Stage-4 Figma frames + §8.4 prototype flows; Playwright covers the §8.4 "Login" journey (§7); remaining legacy component trees + mock `/api/dashboard/*` quarantined (the legacy `/dashboard/*` routes moved to `src/legacy` at W1, §8) |

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

Screen-state parity **[Directive 2026-07-18, carried from design.md §8.1]**:
every data-driven screen ships default, empty, and loading states — the
three-frame rule applies to the implementation exactly as it does to the
Figma templates (EmptyState/MI-16 + first-run copy; Skeleton loading; a
demo-data toggle where the screen's spec calls for one — first application
B1/B2/B4/B5), and the QA loop checks all three.

## 3. Token mapping — design.md §2 → `web/src/design/tokens.css`

One custom property per Figma variable in the `upstat/tokens` collection
(design.md §7); light values on `:root`, dark on `[data-theme="dark"]`.
**Dark is the default** (design.md §2: dashboards + marketing default dark)
— no stored preference resolves to dark; `prefers-color-scheme` honored
with manual override (the theme toggle sets `data-theme`).

| Group | Token names |
| --- | --- |
| Color | `--bg` · `--bg-elev` · `--border` · `--text` · `--text-2` · `--brand` · `--brand-deep` · `--on-brand` · `--ok` · `--warn` · `--crit` · `--nodata` |
| Series palette | `--series-1` … `--series-8` — the §2 8-step categorical set, identical both modes; series→color assignment stable per view session |
| Spacing | `--space-4` `--space-8` `--space-12` `--space-16` `--space-24` `--space-32` `--space-48` `--space-64` — the 4px-grid scale, no off-scale values (data views may compress to the 4px sub-grid: 2px hairline gaps in dense tables, §2) |
| Radii | `--radius: 4px` (the product radius — denser than siblings) · `--radius-full: 9999px` (pills, dots, avatars) |
| Motion | `--duration-fast: 120ms` · `--duration-base: 200ms` · `--duration-slow: 300ms` · `--duration-entrance: 250ms` · `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` · `--ease-exit: cubic-bezier(0.4, 0, 1, 1)` |
| Z layers | `--z-base: 0` · `--z-sticky: 10` · `--z-dropdown: 20` · `--z-overlay: 30` · `--z-sheet: 40` · `--z-toast: 50` |

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
under `/dashboard/<area>`, canonical across the CueLABS products. The
legacy dashboard tree quarantined to `src/legacy/app/dashboard` at W1 to
free the path (§8). Rail order per pages.md Part B.

| pages.md | Route | Screen |
| --- | --- | --- |
| Part A (A1–A16) | `/` | Public home page |
| flows/auth.md · design.md §8.1 Stage 4 | `/signin` | Single auth screen — GoogleAuthButton + legal links (X-1; `/signup` retires, §8; `/login` 308-redirects here) |
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

## 8. Legacy quarantine plan

`web/` is a **live legacy system** — password-auth screens, a
styled-components dashboard shell with mock-data analytics pages, and a
gRPC-Web control-plane client. The §1 policy applies in three tranches,
each timed to the decision that obsoletes the code:

1. **W0 — auth (X-1).** `src/app/login/` and `src/app/signup/` (the
   username/password screens) `git mv` → `src/legacy/` in the W0 PR;
   the new `/signin` (single GoogleAuthButton, §4; renamed from `/login` at W1 per the route standard, with a 308 redirect kept) replaces them —
   flows/auth.md: `/signup` retires, Google-only product-wide. Retirement
   PR after the W0 QA loop passes.
2. **W1/W3 — the dashboard IA (ANA-002).** The legacy `/dashboard/*` route
   tree (traffic, bounce, seo, pageloadtime, error, uptime, help, settings)
   plus the legacy `NavBar`/`MenuBar`/`ProtectedRoute` (they linked the
   retired `/login` with the old auth context) quarantined →
   `src/legacy/` **at W1** — the route standard mounts the new IA at
   `/dashboard` (§4), so the legacy tree had to vacate the path early.
   The remaining legacy component trees (`components/uptime`,
   `components/traffic`, `components/pages`, `shared-layouts`, the
   styled-components theme/registry — the live `/` home still renders
   some) and the mock `/api/dashboard/*` route handlers (api.md §1:
   scaffolding, not product surface) quarantine when W3 closes its QA
   loop, then retire in dedicated `chore(web): retire legacy <area>` PRs;
   the styled-components and chart-library dependencies drop with the
   retirement PRs.
3. **monitors-v2 (OBS-006) — the gRPC-Web client (X-8).** `src/proto/*`,
   `src/client.ts`, and the gRPC libs (`components/libs/grpc`) are
   monitor/user **control-plane code, not UI** — X-8 keeps the existing
   control plane on gRPC until monitors-v2, so this code stays **live**
   past W3. At backend-integration time the monitor repository may wrap
   the gRPC-Web client *inside* the models seam (views stay HTTP-shaped,
   §5); when monitors-v2 flips the dashboard fully HTTP and Envoy retires
   from the cloud topology, the proto tree quarantines and retires in its
   own PR — synchronized with the backend migration, not the W stages.

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
- [ ] Legacy tranches land on schedule: auth at W0, `/dashboard` tree at
      W3, proto/gRPC only at monitors-v2 — nothing outside `src/legacy/`
      is dead code at any point
