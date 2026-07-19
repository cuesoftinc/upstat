"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { LogEvent, Span, Trace } from "@/models";
import { SpanDrawer } from "./SpanDrawer";
import { SpanRow } from "./SpanRow";
import { TraceMinimap } from "./TraceMinimap";

export interface TraceWaterfallProps {
  trace: Trace;
  /** Logs correlated to the trace — the span drawer's logs-in-span tab
   *  shows the lines inside the selected span's service + time window. */
  logs?: LogEvent[];
  className?: string;
}

/** Lines within the span's window (±1.5s skew — the correlation window
 *  the log stream uses) on the span's service. */
function logsForSpan(logs: LogEvent[], span: Span): LogEvent[] {
  const start = Date.parse(span.start) - 1_500;
  const end = Date.parse(span.start) + span.duration_ns / 1e6 + 1_500;
  return logs.filter((log) => {
    if (log.service !== span.service) return false;
    const ts = Date.parse(log.ts);
    return ts >= start && ts <= end;
  });
}

interface PlacedSpan {
  span: Span;
  depth: number;
  offsetFrac: number;
  widthFrac: number;
}

/**
 * TraceWaterfall — §3/§8.2: span rows on a shared time axis + time-axis
 * header + SpanDrawer; hover highlights the service in the minimap (MI-7).
 */
export function TraceWaterfall({ trace, logs = [], className }: TraceWaterfallProps) {
  const [selected, setSelected] = useState<Span | null>(null);
  const [hoverService, setHoverService] = useState<string | null>(null);

  const { placed, services } = useMemo(() => {
    const start = Date.parse(trace.start);
    const total = Math.max(trace.duration_ms, 0.001);
    const byParent = new Map<string | null, Span[]>();
    for (const span of trace.spans) {
      const list = byParent.get(span.parent_id) ?? [];
      list.push(span);
      byParent.set(span.parent_id, list);
    }
    const ordered: PlacedSpan[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const span of byParent.get(parentId) ?? []) {
        ordered.push({
          span,
          depth,
          offsetFrac: (Date.parse(span.start) - start) / total,
          widthFrac: span.duration_ns / 1e6 / total,
        });
        walk(span.span_id, depth + 1);
      }
    };
    walk(null, 0);
    const svc = [...new Set(trace.spans.map((s) => s.service))];
    return { placed: ordered, services: svc };
  }, [trace]);

  const axisTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={clsx("font-ui flex w-full", className)}>
      {/* overflow-x-auto: the fixed-column waterfall (name · service · time
          axis · duration) scrolls inside its panel on narrow viewports */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="min-w-[560px]">
        <TraceMinimap
          spans={trace.spans}
          durationMs={trace.duration_ms}
          startTs={trace.start}
          highlightService={hoverService}
          className="mb-1"
        />
        {/* time-axis header */}
        <div className="flex h-6 items-center border-b border-border px-2">
          <span className="w-56 shrink-0 text-[11px] text-text-2">
            {trace.root_name}
          </span>
          <span className="w-20 shrink-0" />
          <span className="font-data relative min-w-0 flex-1 text-[11px] tabular-nums text-text-2">
            {axisTicks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: `${t * 100}%` }}
              >
                {(trace.duration_ms * t).toFixed(0)}ms
              </span>
            ))}
          </span>
          <span className="w-16 shrink-0" />
        </div>
        <div role="list" aria-label="Trace spans">
          {placed.map(({ span, depth, offsetFrac, widthFrac }) => (
            <SpanRow
              key={span.span_id}
              span={span}
              depth={Math.min(depth, 8)}
              colorIndex={services.indexOf(span.service)}
              offsetFrac={Math.max(0, Math.min(offsetFrac, 1))}
              widthFrac={Math.max(0, Math.min(widthFrac, 1 - Math.max(offsetFrac, 0)))}
              selected={selected?.span_id === span.span_id}
              onSelect={() => setSelected(span)}
              onHover={(hovering) => setHoverService(hovering ? span.service : null)}
            />
          ))}
          </div>
        </div>
      </div>
      {selected && (
        <SpanDrawer
          span={selected}
          logs={logsForSpan(logs, selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
