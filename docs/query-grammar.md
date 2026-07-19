# Upstat — Shared Query Grammar

> The one grammar behind every pillar's QueryBar, `POST /v1/query`, dashboard
> widgets, and monitor rules (design.md §3, api.md §6). Everything here is
> **[Proposed]** — ratify before OBS-001 implementation freezes it.

## 1. Shape

```
<query>      ::= <filters> [ "|" <aggregation> [ "by" <group-list> ] ]
<filters>    ::= <term> { " " <term> }          # terms AND by default
<term>       ::= <facet> ":" <value>
               | <facet> ":" <op> <number>
               | "-" <term>                      # negation
               | <free-text>                     # message/full-text match
               | "(" <term> { " OR " <term> } ")"
<op>         ::= ">" | ">=" | "<" | "<=" | "="
<aggregation>::= <fn> "(" [<field>] ")" [ "," <fn> "(" <field> ")" ... ]
<fn>         ::= count | rate | sum | avg | min | max | p50 | p95 | p99 | uniq
<group-list> ::= <facet> { "," <facet> }
```

Examples:

| Query | Meaning |
| --- | --- |
| `service:api-common status:error` | error logs/spans for one service |
| `service:api-common \| count() by level` | log counts grouped by level |
| `metric:http.request.duration_ms service:web \| p95() by path` | p95 latency per path |
| `-level:debug (service:web OR service:envoy) timeout` | free-text "timeout", two services, no debug |
| `check:homepage \| rate()` | uptime check pass rate |

## 2. Facet namespace

| Prefix | Applies to | Examples |
| --- | --- | --- |
| *(core)* | all signals | `service`, `env`, `host`, `status`, `level` |
| `metric:` | metrics | selects the series; remaining terms filter tags |
| `check:` | synthetics | monitor name/id |
| `trace.` | spans | `trace.endpoint`, `trace.duration_ms`, `trace.error` |
| `rum.` | RUM events | `rum.path`, `rum.vital.lcp`, `rum.country` |
| `@` | custom attributes | `@user_tier:pro` (log/span attrs map) |

Facet autocomplete is fed by the service catalog + per-signal attribute
indexes ranked by cardinality (design.md MI-13).

## 3. Semantics

- **Time never appears in the query** — the global TimePicker supplies
  `[from, to)`; monitor rules supply their evaluation window. One less thing
  to parse, and every query is reusable across ranges.
- Terms AND; explicit `OR` requires parentheses; `-` negates a single term.
- Free text applies to the signal's natural text field (log message, span
  name, event name); quoted strings match phrases.
- `| aggregation` returns series/tables; without it, the raw stream
  (log lines, spans, events) paginates.
- Unknown facets are **errors, not empty results** (MI-13 underline) —
  silent-empty is how users lose an hour.
- Case: facet names lowercase; values case-sensitive except `level`.

## 4. Consumers & translation

| Consumer | Uses |
| --- | --- |
| Explorers (logs/metrics/traces/RUM) | filters + optional aggregation |
| Dashboard widgets | full query persisted in `WIDGET.query` |
| Monitor rules | full query + thresholds evaluated on schedule |
| `/v1/stats` (the events/stats surface, api.md §3.3) | sugar over `rum.*` count queries |

One internal query service parses the grammar into an AST, validates facets
against the catalog/indexes, then compiles per store: ClickHouse SQL for
logs/spans/metrics (U-1 ratified), **Postgres** for control-plane data (X-5).
**Persistence [Decided — unified]: both monitors AND dashboard widgets
persist the AST** (widgets additionally cache the display string).

### AST v1 (versioned JSON — the compatibility contract)

```json
{
  "v": 1,
  "filters": {"op": "and", "terms": [
    {"facet": "service", "cmp": "eq", "value": "api-common"},
    {"op": "or", "terms": [{"facet": "level", "cmp": "eq", "value": "error"},
                             {"facet": "level", "cmp": "eq", "value": "warn"}]},
    {"facet": "trace.duration_ms", "cmp": "gt", "value": 250},
    {"not": {"facet": "level", "cmp": "eq", "value": "debug"}},
    {"text": "timeout"}
  ]},
  "agg": [{"fn": "p95", "field": "trace.duration_ms"}],
  "group_by": ["path"],
  "step": "auto"
}
```

Rules the string grammar adds to §1 **[Decided]**:
- **Quoting/escaping**: values with `:`/spaces/parens are double-quoted;
  `\"` escapes a quote; facet names never need quoting.
- **Nesting**: parentheses nest arbitrarily — `(a OR (b c)) -d` is legal;
  the AST is the normative structure.
- **Typing**: facets are typed at registration (string/number/duration);
  numeric comparators on string facets → `invalid_query`.
- **Step**: `| … by …` series take an implicit `step=auto`
  (range/200 buckets, snapped to 10s/1m/5m/1h/1d); `?step=` overrides.

### Function semantics per signal (normative table)

| fn | logs/events | spans | metrics | checks |
| --- | --- | --- | --- | --- |
| `count()` | row count | span count | point count | check count |
| `rate()` | rows/sec | spans/sec | — (use the metric) | **pass ratio** (passing ÷ completed — the documented exception) |
| `sum/avg/min/max/p50/p95/p99(field)` | numeric attr | field required (e.g. `trace.duration_ms`) | over values | `response_time_ms` |
| `uniq(field)` | distinct attr values | distinct field | distinct series | — |

Bare `p95()` with no field is `invalid_query` everywhere except metrics
(where the selected series' value is implicit).

## 5. URL representation

`?q=<url-encoded query>&from=…&to=…&live=1` on every explorer — shareable,
back/forward-safe (MI-1), and the exact payload of `POST /v1/query`.
