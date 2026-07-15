# Upstat — Product Requirements Breakdown

> Source: "Upstat Product Requirement Document" (provided 2026-07-15) combined
> with the repository state on `main`. The linked
> [Figma file](https://www.figma.com/design/F2b1icjCmZp1MvOft6HMCV/Upstat)
> contains a single desktop landing design (messaging pillars: "Dev-first
> workflows", "Works for your Business needs", "Open-source, Transparent and
> community-driven") — usable for the landing build; its frames are unnamed,
> so a light design-hygiene pass is recommended before handoff.
>
> Markers: **[PRD]** = stated requirement, **[Current]** = verified repository
> fact, **[Proposed]** = design decision introduced here for ratification.

## 1. Product definition — a triple mandate

Upstat is a website & microservice analytics and status-monitoring product:
real-time visibility into web-property health, traffic, and service
statistics. **[PRD]** Reading the PRD against the code, Upstat carries three
distinct mandates:

| Mandate | PRD basis | Current state **[Current]** |
| --- | --- | --- |
| **M1 — Uptime & status monitoring** | "uptime checks, microservice status" (§3 features grid) | **Implemented**: monitors (interval, timeout, failure threshold), scheduled checker, check results, incidents, public status page, ML-assisted insights |
| **M2 — Website analytics** | "website stats", "traffic", "tracking scripts" (§3, §5) | **UI shell only**: dashboard pages for traffic/bounce/SEO/page-load exist on mock `/api/dashboard/*` routes; no ingestion, no tracking script |
| **M3 — Ecosystem event tracker** | "serves as the standardized event tracking service for other products" (§4.2) | **Missing** — and both sibling PRDs depend on it (apparule "Demo Starts"/"GitHub Clicks", expendit "Upload Success"/"Report Generation"). This repo *provides* what their roadmaps call dependency **D2** |

The PRD's §5 restraint governs all three: *"initial functionality must focus on
uptime and basic analytics, avoiding overpromises of complex enterprise
observability."* Upstat is not an APM/tracing/logging product.

Upstat is also self-referential: the PRD requires the site itself to
demonstrate Cuesoft's engineering standards and infrastructure stability
(§5 "Reliability Showcase") — Upstat should monitor Upstat, publicly.
**[PRD, operationalized in roadmap P0]**

## 2. Personas and jobs-to-be-done

| Persona | Job-to-be-done | Primary surface |
| --- | --- | --- |
| Founders & technical teams | Credible, simple monitoring for their properties | Monitors, status pages, alerts |
| Agencies & product owners | Visibility into product health/statistics | Dashboards, reports |
| Cuesoft-managed clients | Reliability reporting on delivered solutions | Status pages, managed reports via `clients.cuesoft.io` |
| Internal engineering (Cuesoft) | Ecosystem reliability + product event analytics | M3 events, dashboards |

## 3. Functional requirements

### 3.1 Stated requirements, mapped against current state

| ID | Requirement | Priority | Current state **[Current]** | Gap |
| --- | --- | --- | --- | --- |
| UPS-001 | Public landing page — value understood within one page | Must | `/` page exists; Figma landing design available | Apply the design; copy per §6 CTAs |
| UPS-002 | Dashboard / app entry — sign in and open the app | Must | Login/signup + Google auth + protected dashboard shell all work | Entry CTAs from landing; account.cuesoft.io later (D1) |
| UPS-003 | Setup documentation — scripts, API endpoints, alert config, retention | Should | `docs/setup.md` covers self-hosting only | User-facing setup guides: monitor creation, tracking-script install, alert config, retention statement (needs M2/M3 + alerts to exist) |
| UPS-004 | Example analytics cards on the public page | Should | Dashboard components exist (uptime cards, charts) | Reuse with demo data on landing |
| UPS-005 | Privacy disclosure — what tracking/service data is collected | Must | Nothing | Privacy page + `privacy.cuesoft.io` clause (D3); must cover visitor-analytics collection (M2) |

### 3.2 Ecosystem requirements

| ID | Requirement | Notes |
| --- | --- | --- |
| ECO-AUTH | Identity via `account.cuesoft.io` | External (D1); current local JWT + Google auth is the interim |
| **ECO-TRACK** | **Be** the standardized cross-product event tracker | Upstat is the *provider* of the ecosystem's D2. Contract in api.md §3; consumers: apparule, expendit, cuesoft.io properties |
| ECO-SUPPORT | Managed-client monitoring reports via `clients.cuesoft.io` | Report generation/export needed first (roadmap P3) |

### 3.3 Derived requirements **[Proposed]** (implied by §3 features grid + M-mandates)

| ID | Requirement | Rationale |
| --- | --- | --- |
| MON-001 | **Alerting** — notify on monitor state change (email first, webhook second) | Features grid says "alerts"; today status flips are silent — a monitoring product that tells no one is a dashboard, not a monitor |
| ANA-001 | Event-ingestion API + JS tracking script | M2/M3 foundation; lightweight page-view + custom-event beacon |
| ANA-002 | Dashboards read real aggregates | Replace the mock `/api/dashboard/*` routes — mocks were acceptable scaffolding, not product |
| ANA-003 | Data-retention policy, stated and enforced | UPS-003 requires documenting retention; you can't document what isn't defined (data-model.md §4 proposes 90d raw / 13mo rollups) |

## 4. Non-goals (initial releases)

- APM, distributed tracing, log aggregation, RUM session replay — the §5
  restraint. Explicitly out until the PRD changes.
- Paid plans/billing (not in PRD).
- Mobile apps.
- Replacing the mock SEO/bounce/page-load pages with real products in v1 —
  they follow once ANA-001 data exists to derive them honestly (roadmap P2).

## 5. Brand & content requirements

- Aesthetic: clean, data-oriented, minimal, credible. **[PRD §2]**
- Landing: hero + dashboard preview, features grid (stats, uptime checks,
  microservice status, alerts, reporting), example dashboards, setup docs,
  app-entry CTAs. **[PRD §3]**
- CTAs: "Open App", "Create Monitor", "View Dashboard". **[PRD §6]**
- Figma: apply the existing desktop design; note its three messaging pillars.

## 6. Compliance & safety requirements

| Concern | Requirement |
| --- | --- |
| Visitor privacy | UPS-005: disclose exactly what the tracking script collects; default to cookieless, anonymized collection **[Proposed]** (data-model.md §4) |
| Ecosystem events | Events from sibling products are counters + coarse dimensions only — never measurement data (apparule) or financial data (expendit); enforce by schema, not convention (api.md §3.2) |
| Legal | Upstat clause in central `privacy.cuesoft.io` hub (D3) **[PRD §7]** |

## 7. Success metrics **[Proposed]**

| Metric | Why |
| --- | --- |
| Monitors created; % monitors with ≥1 alert channel | M1 adoption + MON-001 uptake |
| Properties with live tracking script; events/day ingested | M2/M3 adoption |
| Sibling-product events flowing (apparule, expendit) | ECO-TRACK delivered — unblocks two roadmaps |
| upstat.cuesoft.io's own public status page uptime | §5 reliability showcase, self-referential |

## 8. Open questions

1. **Event API authentication for browsers** — tracking scripts can't hold
   secrets. Proposed: public write-only property key, origin-checked, rate
   limited (api.md §3.1); confirm this satisfies the privacy posture.
2. **Alert channels order** — email first (needs an SMTP/provider decision —
   note the old SMTP plumbing was deliberately removed), webhook second,
   Slack later? MON-001 assumes email→webhook.
3. **gRPC-Web vs REST for new surfaces** — monitors stay gRPC (works today);
   event ingestion + stats query are proposed as plain HTTP/JSON (browser
   beacons + simpler consumer contract). Confirm the split is acceptable.
4. **Managed-client reports** (ECO-SUPPORT) — format and cadence owned by
   `clients.cuesoft.io`? Blocks roadmap P3 shape.
