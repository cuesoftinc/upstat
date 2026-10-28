# Flow: Alerting (channels → rules → dispatch)

> Implements MON-001 with decisions U-4 (webhooks first, email via Brevo).
> Covers channel lifecycle, rule config, dispatch semantics, cooldown, and
> the flapping guard. Data model: `ALERT_RULE`/`ALERT_CHANNEL`
> (data-model.md §2).

## 1. Channels

| Kind | Config | Verification |
| --- | --- | --- |
| Webhook | URL (https only) + optional secret | "Verify" sends a signed test event; channel unusable until a 2xx returns (`verified: true`) |
| Email (Brevo REST API, X-7 — no SMTP) | address | 6-digit code mailed; entered in-app; 15min expiry, 3 attempts |

- Channels are owner-scoped and reusable across monitors.
- Webhook signing: `X-Upstat-Signature: hex(hmac-sha256(secret, body))` +
  `X-Upstat-Timestamp`; consumers must reject >5min skew (documented in
  UPS-003 setup docs).
- Failing channels: 5 consecutive **dispatch-level failures** (post-retry
  `failed` rows) → `degraded` badge + email-to-owner + banner; resets on the
  first `delivered`. Email (Brevo API) failures use the same ladder/timeout as
  webhooks. Deliveries keep trying (no auto-disable).
- Deleting a channel detaches it from all rules; rules left with zero
  channels show a "no destination" warning badge.

## 2. Rules

Per monitor: `on: down | recovered | nodata | all` **(nodata opt-in)**,
`cooldown_minutes` (default 30, 0–1440). One rule may fan out to many
channels. Defaults on first channel creation: a `down+recovered` rule is
offered pre-filled for every existing monitor (bulk opt-in sheet) — empty
alerting after setup is a product failure.

## 3. Dispatch semantics

```mermaid
sequenceDiagram
    participant W as Worker (state change)
    participant D as Dispatcher
    participant CH as Channels

    W->>D: transition {monitor, from, to, at, cause}
    D->>D: load rules · filter by 'on' · check cooldown stamps
    alt within cooldown
        D->>D: drop (recorded as suppressed in alert feed)
    else
        D->>CH: deliver (parallel, per-channel retry ×3, backoff 1s/5s/25s)
        D->>D: stamp cooldown per rule
    end
```

- **At-least-once, durably [Decided]**: every dispatch writes a
  `DISPATCH { rule, channel, transition, state: pending|delivered|failed,
  attempts, next_attempt_at }` row BEFORE delivery; a crash-recovery scan on
  worker start re-drives `pending` rows — the transition and its
  notifications can't be lost together. Per-attempt webhook timeout **10s**;
  retry ladder 1s/5s/25s then `failed`.
- **Ordering**: `recovered` dispatch on a channel waits for the paired
  `down` dispatch to reach a terminal state (`delivered` OR `failed` after
  retries); if the `down` ended `failed`, the `recovered` message prepends
  "(missed: was down since {t})" so the recipient gets the full story.
- **Cooldown** applies per rule per state-direction — a `down` at minute 0
  suppresses re-`down` noise until cooldown lapses, but never suppresses the
  `recovered`.
- **Renotify** (delta, optional): `renotify_minutes` re-sends "still down"
  while an incident stays open; off by default.
- **Flapping guard** (with monitor.md §2), precise algorithm **[Decided]**:
  count only `up↔down` edges (nodata/pause edges excluded) in a **sliding
  30-min window**; the 7th edge enters flapping mode → one `monitor.flapping`
  dispatch (bypasses per-rule cooldown, fires on rules with `on: down` or
  `all`), then suppression; exit when the sliding window holds ≤1 edge
  ("30 quiet minutes" = that predicate); on exit, one summary line in the
  feed and normal dispatch resumes with cooldown stamps reset. Suppressed
  transitions remain visible in the alert feed (MI-14).

## 4. Payloads

Webhook (versioned envelope):

```json
{
  "version": 1,
  "event": "monitor.down | monitor.recovered | monitor.nodata | monitor.flapping",
  "monitor": {"id": "…", "name": "…", "target": "…"},
  "transition": {"from": "up", "to": "down", "at": "2026-07-16T12:00:00Z",
                  "cause": "timeout", "consecutive_failures": 3},
  "incident": {"id": "…", "started_at": "…"}
}
```

Email: subject `[Upstat] {name} is DOWN` / `RECOVERED — was down 14m`;
body = status, cause, duration, per-monitor page link, unsubscribe →
channel settings. No target URL in the subject (URLs in subjects trip spam
filters and leak internals into notification previews).

## 5. Acceptance

- [ ] Unverified channels cannot be attached to rules
- [ ] Webhook signature verifiable by the documented recipe (fixture test)
- [ ] Down at t0 + recover at t1 < cooldown: both delivered, in order
- [ ] Flapping storm produces exactly one alert + truthful history
- [ ] Channel outage degrades that channel only; suppressions visible
- [ ] `nodata` alerts fire only where opted in
