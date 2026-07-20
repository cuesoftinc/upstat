/** Metrics / logs / traces entities — data-model.md §5 telemetry-plane shapes. */

/** Metrics-summary catalog row (pages.md B3). */
export interface MetricSummary {
  name: string;
  type: "gauge" | "count" | "distribution";
  unit?: string;
  cardinality: number;
  ingestion_rate_per_s: number;
  last_seen: string;
  tags: string[];
}

/** A named metric series (mirror of the ClickHouse `metrics_points` grain). */
export interface MetricSeries {
  name: string;
  tags: Record<string, string>;
  points: { ts: string; value: number }[];
}

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

/** LogEvent — the ClickHouse `logs` row shape (data-model.md §5 DDL). */
export interface LogEvent {
  id: string;
  ts: string;
  service: string;
  level: LogLevel;
  host: string;
  message: string;
  attrs: Record<string, unknown>;
  trace_id?: string;
}

export interface LogQueryPage {
  events: LogEvent[];
  /** Opaque cursor for the next (older) page; absent at the end. */
  next_cursor?: string;
  /** Level-stacked histogram buckets for the explorer header (LogHistogram). */
  histogram: { ts: string; counts: Record<LogLevel, number> }[];
  /** Facet counts for the FacetSidebar (service/level/host + custom). */
  facets: Record<string, { value: string; count: number }[]>;
}

/** One clustered message template (pages.md B4 Patterns tab, OBS-012). */
export interface LogPattern {
  /** Message shape with `<placeholders>` marking the clustered variables. */
  template: string;
  count: number;
  dominant_level: LogLevel;
  /** 7-bucket trend across the queried range, oldest → newest. */
  trend: number[];
  /** Up to 3 newest matching lines (the expand affordance). */
  samples: LogEvent[];
}

export interface LogPatternsResult {
  patterns: LogPattern[];
  total_lines: number;
  /** Width of one trend bucket. */
  bucket_ms: number;
  /** True when the range was sampled (counts scaled by the stride). */
  sampled: boolean;
}

export type SpanStatus = "ok" | "error";

/** Span — the ClickHouse `spans` row shape (data-model.md §5 DDL). */
export interface Span {
  trace_id: string;
  span_id: string;
  parent_id: string | null;
  service: string;
  name: string;
  start: string;
  duration_ns: number;
  status: SpanStatus;
  attrs: Record<string, string>;
}

/** Trace summary row for the explorer list (pages.md B5). */
export interface TraceSummary {
  trace_id: string;
  root_service: string;
  root_name: string;
  start: string;
  duration_ms: number;
  span_count: number;
  status: SpanStatus;
}

export interface Trace extends TraceSummary {
  spans: Span[];
}

/** APM service-list row (pages.md B5: req/s, p50/p95/p99, error rate). */
export interface ServiceStats {
  service: string;
  req_per_s: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  error_rate: number;
  apdex: number;
}
