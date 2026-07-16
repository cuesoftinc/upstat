# Flow: Uptime Monitor (create → check → status)

> The M1 core from the user's side plus the **evaluation semantics** the
> worker implements — window behaviour, no-data policy, flapping. Grounded in
> the existing implementation (`monitor_worker_service.go`, `checker_service.go`)
> and marks deltas. Preconditions: authed (Google-only, flows/auth.md).

## 1. Create / edit

| Field | Validation | Notes |
| --- | --- | --- |
| Name | 1–80 chars, unique per owner | `409 name_taken` |
| Target | absolute `http(s)://` URL; DNS-resolvable not required at save; URL userinfo (`user:pass@`) rejected (`422 invalid_target`) | **Cloud: RFC-1918/link-local/loopback/metadata (169.254.169.254) targets are DENIED (`422 target_not_allowed`), enforced at check time on every resolved IP (DNS-rebinding-safe: resolve, validate, pin)** — SSRF hard rule, REVISES the earlier warn-only default. Self-host: allowed by default, deny-list configurable |
| Type | `website \| server \| api \| blog` | display taxonomy only — checks behave identically **[Current]** |
| Interval | 30s–24h, default 60s **[Current default]** | sub-30s is a paid-tier conversation, out of scope |
| Timeout | 1s–60s, default 10s; must be < interval | `422 timeout_gte_interval` |
| Failure threshold | 1–10, default 3 | consecutive failures before `down` |

Edits apply from the next scheduled check; in-flight checks complete under
old config. Pausing (`active: false`) stops scheduling and freezes status at
`paused` (a distinct display state — not `up`, not `down`).

## 2. Evaluation semantics (the contract the worker honours)

```mermaid
stateDiagram-v2
    [*] --> pending : created (never checked)
    pending --> up : first passing check
    pending --> down : threshold consecutive failures
    up --> down : consecutiveFailures ≥ threshold
    down --> up : first passing check (recovery is immediate)
    up --> nodata : no check completed for 2×interval
    nodata --> up : passing check
    nodata --> down : threshold failures
    up --> paused : active=false
    down --> paused
    paused --> pending : re-activated (fresh slate)
```

- **A check passes** iff HTTP response arrives within timeout AND status
  code < 400 **[Current behaviour; 3xx follows redirects up to 5]**.
- **Failure asymmetry is deliberate**: going `down` needs `threshold`
  consecutive failures (flap damping); going `up` needs exactly one success
  (recovery news travels fast).
- **`nodata`** (delta): if no check completes for 2×interval, status becomes
  `nodata`, never a synthetic `down`. **Mechanism [Decided]**: evaluated
  lazily at read time (status queries compare `lastCheckedAt` vs 2×interval)
  AND materialized by a sweep in the worker loop (so alert rules with
  `on: nodata` fire without reads). A crashed worker can't write anything —
  lazy evaluation is what keeps the UI honest; the sweep catches up on
  restart. Alerting treats `nodata` per-rule (opt-in).
- **Pause/resume side-effects [Decided]**: pause freezes status at `paused`,
  closes any open incident as `resolved: paused`, clears cooldown stamps and
  `consecutiveFailures`; resume starts at `pending` with a fresh slate (first
  check decides). 
- **Flapping guard** (delta): >6 transitions in 30min collapses
  notifications into one "flapping" alert (flows/alert.md §4); the status
  history itself records every transition truthfully.
- **Incidents [REVISED]**: opened on any transition **into `down`**
  (`up→down`, `pending→down`, `nodata→down`), closed on `down→up`;
  transitions among `pending/nodata/paused` (not involving `down`) never
  touch incidents. Pausing a monitor with an open incident **closes it as
  `resolved: paused`** (annotated cause).

## 3. Check records & per-monitor page

Scheduler contract **[Decided]**: monitors are spread across their interval
by hash-jitter (no thundering herd); worker concurrency cap 50 in-flight
checks per instance; missed slots (downtime) are skipped, not backfilled
(drift policy: next slot wins); cloud egress IPs are published in setup docs
for customer allowlists. **Cloud Run: the worker requires `min-instances: 1`
and a scheduler singleton lease** (Postgres advisory lock) so scale-out
never double-schedules — checks are leased by one instance; the HTTP surface
scales freely (deployment.md).

Each check persists: `up`, `status_code` (0 = transport error), 
`response_time_ms`, `checked_at` (90d retention, U-6). The monitor page
(pages.md B7) renders: UptimeCard strip (90d), response-time chart, incident
list, ML insight panel. Uptime % = passing ÷ completed checks over the window
(`nodata` gaps excluded from the denominator — shown as gray, counted as
neither).

## 4. Error taxonomy (user-visible on check detail)

| Recorded cause | Meaning |
| --- | --- |
| `timeout` | no response within timeout (measured across the whole redirect chain) |
| `dns` | resolution failed |
| `tls` | handshake/cert failure (incl. expired cert — cert-expiry *warning* checks are OBS-011 later) |
| `refused` | connection refused |
| `http_4xx` / `http_5xx` | response ≥400 |
| `too_many_redirects` | >5 redirects |

## 5. Instrumentation & acceptance

Dogfood events: `monitor_created`, `monitor_state_changed{to}`.

- [ ] Threshold/recovery asymmetry proven by table-driven worker tests
- [ ] Worker outage yields `nodata`, not `down`; no phantom incidents
- [ ] Pause freezes status + stops checks; resume starts from `pending`
- [ ] Edits apply next-cycle; no double-scheduling under config churn
- [ ] Uptime % math excludes `nodata` from denominator
