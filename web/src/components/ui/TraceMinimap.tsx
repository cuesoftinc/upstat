"use client";

import { clsx } from "clsx";
import { useMemo } from "react";
import type { Span } from "@/models";

export interface TraceMinimapProps {
  spans: Span[];
  durationMs: number;
  startTs: string;
  /** MI-7: highlight all bars of a service in its series color. */
  highlightService?: string | null;
  className?: string;
}

/** TraceMinimap — §8.2b: default / span-service highlight (series color). */
export function TraceMinimap({
  spans,
  durationMs,
  startTs,
  highlightService = null,
  className,
}: TraceMinimapProps) {
  const services = useMemo(() => [...new Set(spans.map((s) => s.service))], [spans]);
  const start = Date.parse(startTs);
  const total = Math.max(durationMs, 0.001);

  return (
    <svg
      role="img"
      aria-label="trace minimap"
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      className={clsx("h-3 w-full rounded-[1px] bg-bg", className)}
    >
      {spans.map((span, i) => {
        const left = ((Date.parse(span.start) - start) / total) * 100;
        const width = Math.max((span.duration_ns / 1e6 / total) * 100, 0.5);
        const highlighted = highlightService === span.service;
        return (
          <rect
            key={span.span_id}
            x={Math.max(0, Math.min(left, 100))}
            y={(i % 4) * 3 + 0.5}
            width={Math.min(width, 100)}
            height={2}
            fill={`var(--color-series-${(services.indexOf(span.service) % 8) + 1})`}
            opacity={highlightService === null ? 0.7 : highlighted ? 1 : 0.2}
          />
        );
      })}
    </svg>
  );
}
