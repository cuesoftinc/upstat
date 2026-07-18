/**
 * Shared query grammar — query-grammar.md. The AST (v1) is the normative,
 * versioned structure persisted by widgets and monitor rules.
 */

export type QueryCmp = "eq" | "gt" | "gte" | "lt" | "lte";

export type QueryTerm =
  | { facet: string; cmp: QueryCmp; value: string | number }
  | { op: "and" | "or"; terms: QueryTerm[] }
  | { not: QueryTerm }
  | { text: string };

export type QueryFn =
  | "count"
  | "rate"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "p50"
  | "p95"
  | "p99"
  | "uniq";

export interface QueryAgg {
  fn: QueryFn;
  field?: string;
}

/** AST v1 — query-grammar.md §4 (the compatibility contract). */
export interface QueryAst {
  v: 1;
  filters: { op: "and" | "or"; terms: QueryTerm[] };
  agg?: QueryAgg[];
  group_by?: string[];
  /** `auto` = range/200 buckets snapped to 10s/1m/5m/1h/1d; explicit overrides. */
  step?: "auto" | string;
}

/** POST /v1/query request — time never appears in the query string (§3). */
export interface QueryRequest {
  /** Query string form (`?q=` / QueryBar contents). */
  q: string;
  from: string;
  to: string;
  step?: string;
}

export interface SeriesPoint {
  /** RFC3339 bucket timestamp. */
  ts: string;
  value: number | null;
}

export interface Series {
  /** Display name, e.g. `p95(trace.duration_ms) service:web`. */
  name: string;
  /** Group-by tag values when the query has `by`. */
  tags: Record<string, string>;
  points: SeriesPoint[];
}

export interface TimeseriesResult {
  kind: "timeseries";
  series: Series[];
  step: string;
}

export interface TableResult {
  kind: "table";
  columns: string[];
  rows: (string | number | null)[][];
}

export type QueryResult = TimeseriesResult | TableResult;
