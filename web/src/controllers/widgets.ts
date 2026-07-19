"use client";

/**
 * B2 widget data controller — one hook per WidgetShell body: resolves a
 * widget's query (template vars substituted) against the right repository
 * for its type. Views render the result; they never fetch.
 */

import { useMemo, useState } from "react";
import type {
  LogEvent,
  Monitor,
  QueryResult,
  ServiceStats,
  Slo,
  Widget,
} from "@/models";
import {
  logsRepo,
  monitorsRepo,
  queryRepo,
  slosRepo,
  tracesRepo,
} from "@/models/repositories";
import { useRequest, type RequestState } from "./use-request";
import { useTimeRange } from "./time-range";

/** `$var` substitution — pages.md B2 template variables (`$env`, `$service`). */
export function substituteVars(
  query: string,
  vars: Record<string, string>,
): string {
  return query.replace(
    /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (m, name: string) => vars[name] ?? m,
  );
}

export interface WidgetData {
  query: RequestState<QueryResult> | null;
  logs: RequestState<{ events: LogEvent[] }> | null;
  slos: RequestState<Slo[]> | null;
  monitors: RequestState<Monitor[]> | null;
  services: RequestState<ServiceStats[]> | null;
  /** The resolved (vars-substituted) query string, for the chip. */
  resolvedQuery: string;
}

const QUERY_TYPES = new Set([
  "timeseries",
  "query_value",
  "toplist",
  "table",
  "heatmap",
  "trace_latency",
]);

export function useWidgetData(
  widget: Widget,
  vars: Record<string, string>,
): WidgetData {
  const time = useTimeRange();
  const resolvedQuery = useMemo(
    () => substituteVars(widget.query_string ?? "", vars),
    [widget.query_string, vars],
  );

  const isQuery = QUERY_TYPES.has(widget.type);
  const isLogs = widget.type === "logstream";
  const isSlo = widget.type === "slo";
  const isStatus = widget.type === "status";
  const isMap = widget.type === "servicemap";

  const query = useRequest<QueryResult>(
    () =>
      isQuery && resolvedQuery
        ? queryRepo.run({
            q: resolvedQuery,
            from: time.fromIso,
            to: time.toIso,
          })
        : Promise.resolve({ kind: "timeseries", series: [], step: "1m" }),
    [isQuery, resolvedQuery, time.fromIso, time.toIso],
  );

  const logs = useRequest(
    () =>
      isLogs
        ? logsRepo.query({
            q: resolvedQuery,
            from: time.fromIso,
            to: time.toIso,
            limit: 8,
          })
        : Promise.resolve({
            events: [] as LogEvent[],
            histogram: [],
            facets: {},
          }),
    [isLogs, resolvedQuery, time.fromIso, time.toIso],
  );

  const slos = useRequest(
    () => (isSlo ? slosRepo.list() : Promise.resolve([] as Slo[])),
    [isSlo],
  );
  const monitors = useRequest(
    () => (isStatus ? monitorsRepo.list() : Promise.resolve([] as Monitor[])),
    [isStatus],
  );
  const services = useRequest(
    () =>
      isMap ? tracesRepo.services() : Promise.resolve([] as ServiceStats[]),
    [isMap],
  );

  return {
    query: isQuery ? query : null,
    logs: isLogs ? logs : null,
    slos: isSlo ? slos : null,
    monitors: isStatus ? monitors : null,
    services: isMap ? services : null,
    resolvedQuery,
  };
}

/** MI-2: one crosshair shared by every panel in a view. */
export function useCrosshair() {
  const [cursor, setCursor] = useState<number | null>(null);
  return { cursor, setCursor };
}

/** Deterministic heatmap cells from a series (time × value-bucket grid). */
export function seriesToHeatmap(
  series: { points: { ts: string; value: number | null }[] } | undefined,
): {
  columns: string[];
  rows: string[];
  values: number[][];
} {
  const points = series?.points ?? [];
  const stride = Math.max(1, Math.floor(points.length / 24));
  const sampled = points.filter((_, i) => i % stride === 0);
  const vals = sampled.map((p) => p.value ?? 0);
  const max = Math.max(...vals, 1);
  const bucketCount = 5;
  const rows = Array.from({ length: bucketCount }, (_, r) => {
    const hi = (max * (bucketCount - r)) / bucketCount;
    return hi >= 1000 ? `${Math.round(hi / 100) / 10}k` : `${Math.round(hi)}`;
  });
  const values = rows.map((_, r) =>
    sampled.map((p, c) => {
      const v = vals[c];
      const bucketOfV = Math.min(
        bucketCount - 1,
        Math.floor((1 - v / max) * bucketCount),
      );
      const dist = Math.abs(r - bucketOfV);
      const base = Math.max(0, 9 - dist * dist * 3);
      // deterministic texture from grid position
      return Math.max(0, Math.round(base + ((c * 7 + r * 13) % 5) - 2));
    }),
  );
  return { columns: sampled.map((p) => p.ts.slice(11, 16)), rows, values };
}

/** Default widget definition per type — the create/add flows (pages.md B2). */
export function defaultWidget(
  type: Widget["type"],
): Omit<Widget, "id" | "dashboard_id"> {
  const base = {
    query: null,
    viz_options: {} as Record<string, unknown>,
    layout: { x: 0, y: 99, w: 6, h: 3 },
  };
  switch (type) {
    case "timeseries":
      return {
        ...base,
        type,
        title: "p95 latency by service",
        query_string: "metric:http.request.duration_ms | p95() by service",
        viz_options: { display: "line" },
      };
    case "query_value":
      return {
        ...base,
        type,
        title: "Requests /s",
        query_string: "metric:http.requests_total | rate()",
        viz_options: { sparkline: true },
        layout: { ...base.layout, w: 3, h: 2 },
      };
    case "toplist":
      return {
        ...base,
        type,
        title: "Top services by errors",
        query_string: "metric:http.errors_total | sum() by service",
        viz_options: { limit: 5 },
      };
    case "table":
      return {
        ...base,
        type,
        title: "Services",
        query_string: "metric:http.requests_total | rate() by service",
      };
    case "heatmap":
      return {
        ...base,
        type,
        title: "Latency distribution",
        query_string: "metric:http.request.duration_ms | p95() by service",
      };
    case "logstream":
      return {
        ...base,
        type,
        title: "Error logs",
        query_string: "level:ERROR",
      };
    case "trace_latency":
      return {
        ...base,
        type,
        title: "Trace latency — api-common",
        query_string:
          "metric:http.request.duration_ms service:api-common | p50(), p95(), p99()",
      };
    case "slo":
      return {
        ...base,
        type,
        title: "SLOs",
        layout: { ...base.layout, w: 4, h: 2 },
      };
    case "status":
      return {
        ...base,
        type,
        title: "Uptime checks",
        layout: { ...base.layout, w: 4, h: 2 },
      };
    case "servicemap":
      return { ...base, type, title: "Service map" };
    case "markdown":
      return {
        ...base,
        type,
        title: "Notes",
        viz_options: { text: "Double-click Edit to write runbook notes here." },
        layout: { ...base.layout, w: 4, h: 2 },
      };
  }
}
