# Upstat — Analytics Math Contract (events → rollups → stats)

> The exact math behind the events layer (M2/M3, decisions U-2/U-3/U-6):
> visitor hashing, sessionization, rollups, uniques, and the honesty rules
> for what the UI may claim. Complements flows/monitor.md (uptime math lives
> there) and query-grammar.md.

## 1. Visitor hash (U-3, normative)

```
visitor_hash = hex( SHA-256( daily_salt ‖ property_id ‖ ip ‖ user_agent ) )[:32]
```

- `daily_salt`: 32 random bytes per UTC day, **selected by the event's `ts`
  day** (not arrival time) so late events hash consistently with their
  bucket; a day's salt is destroyed **48h after that day ends** (aligned with
  the ingest window §5 — after destruction no event can legally arrive for
  it). Cross-day linkage remains cryptographically dead — the privacy
  guarantee UPS-005 publishes is unchanged (no salt ever spans two days).
- `ip` is used pre-hash only; never stored. Proxied requests use the
  left-most public address in `X-Forwarded-For` as seen by our LB.
- Consequences (documented, not hidden): the same person counts anew each
  day; shared NAT + identical UA under-counts; UA changes over-count.
  That's the cookieless trade and we say so.

## 2. Sessionization (derived, not stored per-event)

A *visit* = consecutive events with the same `visitor_hash` on one property
with gaps < 30 min. Computed inside the rollup job into a dedicated
**`VISIT_ROLLUP`** row family `(property, period, bucket)` — columns:
`visits`, `bounce_visits`, `total_visit_seconds` (data-model §2 gains the
entity). Attribution rules **[Decided]**: a visit belongs to the bucket of
its **first event**; a *bounce* = a visit whose only **page_view** count is
1 (custom events don't break bounce-ness); visits have no dims (dims apply
to event rollups only — the cardinality-explosion guard). Event `ROLLUP`
rows are per `(name, single-dim-key, dim-value)`, never dim cross-products,
capped at the **top 1,000 dim values per bucket** (the tail aggregates to
`__other__`). Derived UI metrics:

| Metric | Formula | Honesty note |
| --- | --- | --- |
| Bounce rate | bounce_visits ÷ visits | undefined (—) when visits = 0 |
| Avg. visit duration | total_visit_seconds ÷ (visits − bounce_visits) | bounces excluded; label says "engaged visits" |
| Pages / visit | page_view count ÷ visits | |

## 3. Rollups

Hourly job (observability service) aggregates raw events into `ROLLUP` rows
keyed `(property, period, bucket, name, dims)`:

- `count` = exact event count.
- `uniques` = **exact** `COUNT(DISTINCT visitor_hash)` within the bucket
  (volumes make exact feasible; no sketches in v1).
- Daily rollups aggregate from raw events (not from hourly rollups) so daily
  uniques are exact for the day.
- Idempotent upserts: the job recomputes every bucket whose **end** is
  within the trailing 48h — late events self-heal; a bucket becomes immutable
  only once `bucket_end < now − 48h`, which (with the §5 accept window)
  guarantees nothing accepted can target an immutable bucket.

## 4. Uniques across ranges (the non-additivity rule)

`Σ uniques(day)` over-counts multi-day visitors — but cross-day linkage is
deliberately impossible (§1), so **cross-day "unique visitors" does not
exist in this product**. Normative UI rules:

| Range | What "uniques" shows |
| --- | --- |
| ≤ 1 day | the day's exact uniques |
| Multi-day | *daily-average uniques* (labeled exactly that) + the per-day series; never a summed "total uniques" |

Any chart or API consumer summing uniques across buckets is wrong by
specification — `/v1/stats` returns `uniques_additive: false` in range
metadata to make the contract machine-visible.


## 4a. Server-emitted events (sibling APIs)

Events from sibling *servers* (registry `api` rows) carry the sending
server's IP/UA — hashing them would fabricate visitors. They are marked
`unique_ineligible` in the registry (api.md §3.4a): counted in `count`,
**excluded from `uniques` and visit math entirely**. `/v1/stats` for such
events returns `uniques: null`.

## 5. Ingest-time bounding

Events accept client `ts` within `[now − 48h, now + 5min]`; outside →
rejected (`422 ts_out_of_range`, counted in the property's rejected
counter). The 48h floor matches the rollup self-heal window — nothing
accepted can land in an immutable bucket.

## 6. Rate limits & rejection accounting

Per property key: 600 events/min sustained, burst 1,200 **[Decided
defaults]**; over-limit → `429` with `Retry-After`. All rejections
(schema, origin, rate, ts) increment per-property `rejected{reason}`
counters visible in property settings — silent data loss is not acceptable
even for rejected data.

## 7. Acceptance

- [ ] Salt rotation proven: same visitor, consecutive days → different hashes; same day → stable
- [ ] Raw IP/UA absent from every stored row and log line (grep-proven)
- [ ] Rollup idempotency: re-running the job changes nothing for settled buckets
- [ ] Late event within 48h lands correctly; outside window rejected + counted
- [ ] Multi-day stats responses carry `uniques_additive: false`; UI shows daily-average labeling
- [ ] Bounce/duration formulas match fixtures incl. zero-visit buckets
