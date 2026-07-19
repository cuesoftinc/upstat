"use client";

/**
 * WidgetBody — renders a widget's content by type from controller data
 * (pages.md B2 widget list). The remaining types compose existing sets
 * inside WidgetShell per design.md §8.2's closing note.
 */

import { Heatmap } from "@/components/ui/Heatmap";
import { LogLine } from "@/components/ui/LogLine";
import { QueryValue } from "@/components/ui/QueryValue";
import { SLOCard } from "@/components/ui/SLOCard";
import { ServiceMapNode } from "@/components/ui/ServiceMapNode";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { Table } from "@/components/ui/Table";
import {
  TimeseriesPanel,
  type TimeseriesMode,
} from "@/components/ui/TimeseriesPanel";
import { TopList } from "@/components/ui/TopList";
import type { Series, Widget } from "@/models";
import { monitorPillStatus } from "@/controllers/monitors";
import { seriesToHeatmap, useWidgetData } from "@/controllers/widgets";

function lastValue(series: Series | undefined): number {
  const pts = series?.points ?? [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const v = pts[i].value;
    if (v !== null) return v;
  }
  return 0;
}

function shortName(series: Series): string {
  return series.tags.service ?? series.name;
}

export interface WidgetBodyProps {
  widget: Widget;
  vars: Record<string, string>;
  /** MI-2: crosshair sync across every widget on the dashboard. */
  cursor: number | null;
  onCursorChange: (cursor: number | null) => void;
  /** MI-3: drag-zoom hands the fraction window to the time controller. */
  onZoomRange: (fromFrac: number, toFrac: number) => void;
  onZoomReset: () => void;
  /** Plot height by grid rows. */
  height: number;
}

export function WidgetBody({
  widget,
  vars,
  cursor,
  onCursorChange,
  onZoomRange,
  onZoomReset,
  height,
}: WidgetBodyProps) {
  const data = useWidgetData(widget, vars);
  const ts = data.query?.data?.kind === "timeseries" ? data.query.data : null;
  const loading = data.query?.loading ?? false;

  switch (widget.type) {
    case "timeseries":
    case "trace_latency": {
      return (
        <TimeseriesPanel
          chrome={false}
          title={widget.title}
          series={ts?.series ?? []}
          mode={(widget.viz_options.display as TimeseriesMode) ?? "line"}
          loading={loading}
          height={height}
          cursor={cursor}
          onCursorChange={onCursorChange}
          onZoomRange={onZoomRange}
          onZoomReset={onZoomReset}
        />
      );
    }
    case "query_value": {
      if (loading) return <Skeleton kind="value" />;
      const series = ts?.series[0];
      const v = lastValue(series);
      const sparkline = (series?.points ?? [])
        .map((p) => p.value ?? 0)
        .slice(-24);
      const precision = (widget.viz_options.precision as number) ?? 0;
      return (
        // no label — WidgetShell's header already carries the widget title;
        // a labeled QueryValue rendered it twice (UX walk 2026-07-19)
        <QueryValue
          value={v.toFixed(precision)}
          sparkline={widget.viz_options.sparkline ? sparkline : undefined}
          threshold="none"
        />
      );
    }
    case "toplist": {
      if (loading) return <TopList entries={[]} loading />;
      const limit = (widget.viz_options.limit as number) ?? 5;
      const entries = (ts?.series ?? [])
        .map((s) => ({
          label: shortName(s),
          value: Math.round(lastValue(s) * 100) / 100,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
      return <TopList entries={entries} />;
    }
    case "table": {
      if (loading) return <Skeleton kind="line" />;
      const rows = (ts?.series ?? []).map((s) => ({
        service: shortName(s),
        value: Math.round(lastValue(s) * 100) / 100,
      }));
      return (
        <Table
          columns={[
            { key: "service", label: "Service" },
            { key: "value", label: "Value", numeric: true },
          ]}
          rows={rows}
        />
      );
    }
    case "heatmap": {
      if (loading) return <Skeleton kind="panel-axis" style={{ height }} />;
      const grid = seriesToHeatmap(ts?.series[0]);
      return (
        <Heatmap columns={grid.columns} rows={grid.rows} values={grid.values} />
      );
    }
    case "logstream": {
      const events = data.logs?.data?.events ?? [];
      if (data.logs?.loading) return <Skeleton kind="line" />;
      return (
        <ul aria-label={widget.title} className="flex flex-col overflow-hidden">
          {events
            .slice(0, Math.max(3, Math.floor(height / 28)))
            .map((event) => (
              <li key={event.id}>
                <LogLine event={event} />
              </li>
            ))}
        </ul>
      );
    }
    case "slo": {
      const slos = data.slos?.data ?? [];
      const wanted = widget.viz_options.slo_id as string | undefined;
      const slo = slos.find((s) => s.id === wanted) ?? slos[0];
      if (data.slos?.loading) return <Skeleton kind="value" />;
      if (!slo)
        return <p className="text-[13px] text-text-2">No SLOs defined.</p>;
      return <SLOCard slo={slo} className="border-0 bg-transparent p-0" />;
    }
    case "status": {
      const monitors = data.monitors?.data ?? [];
      if (data.monitors?.loading) return <Skeleton kind="line" />;
      return (
        <ul aria-label={widget.title} className="grid grid-cols-2 gap-2">
          {monitors.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px]">
              <StatusPill status={monitorPillStatus(m.status)} />
              <span className="truncate text-text-2">{m.name}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "servicemap": {
      const services = data.services?.data ?? [];
      if (data.services?.loading) return <Skeleton kind="line" />;
      return (
        <ul
          aria-label={widget.title}
          className="flex flex-wrap items-center gap-3"
        >
          {services.slice(0, 6).map((s, i) => (
            <li key={s.service}>
              <ServiceMapNode
                name={s.service}
                reqPerS={s.req_per_s}
                errorRate={s.error_rate}
                colorIndex={i}
              />
            </li>
          ))}
        </ul>
      );
    }
    case "markdown": {
      // typeof guard, not a cast: a non-string value would render as a
      // React child and throw (defense in depth behind the import parser)
      const text =
        typeof widget.viz_options.text === "string"
          ? widget.viz_options.text
          : "";
      return (
        <article className="whitespace-pre-wrap text-[13px] leading-[1.45] text-text-2">
          {text}
        </article>
      );
    }
  }
}
