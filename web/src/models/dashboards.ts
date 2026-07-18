import type { QueryAst } from "./query";

/** Widget types — pages.md B2 (the 11-type list) / data-model.md §5 WIDGET.type. */
export type WidgetType =
  | "timeseries"
  | "query_value"
  | "toplist"
  | "table"
  | "heatmap"
  | "logstream"
  | "trace_latency"
  | "slo"
  | "status"
  | "servicemap"
  | "markdown";

/** 12-col grid placement (design.md §2 layout: 12-col, 8px gutters). */
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Widget — data-model.md §5. Persists the AST (query-grammar.md §4, unified persistence). */
export interface Widget {
  id: string;
  dashboard_id: string;
  type: WidgetType;
  title: string;
  /** Normative structure; `query_string` is the cached display string. */
  query: QueryAst | null;
  query_string?: string;
  viz_options: Record<string, unknown>;
  layout: WidgetLayout;
}

/** Dashboard — data-model.md §5 (org-shared, favorites, template vars, portable JSON). */
export interface Dashboard {
  id: string;
  org_id: string;
  name: string;
  favorite: boolean;
  shared: boolean;
  /** Template variables, e.g. `$env`, `$service` (pages.md B2). */
  template_vars: Record<string, string[]>;
  widgets: Widget[];
  updated_at: string;
}
