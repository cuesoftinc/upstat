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
| `/v1/stats` (legacy events path) | sugar over `rum.*` count queries |

One internal query service parses the grammar into an AST, validates facets
against the catalog/indexes, then compiles per store: ClickHouse SQL for
logs/spans/metrics (pending R2), Mongo aggregation for control-plane data.
The AST — not the string — is what monitors persist, so grammar evolution
can re-serialize saved queries.

## 5. URL representation

`?q=<url-encoded query>&from=…&to=…&live=1` on every explorer — shareable,
back/forward-safe (MI-1), and the exact payload of `POST /v1/query`.
