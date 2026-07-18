"use client";

import { clsx } from "clsx";
import type { Span } from "@/models";

export interface SpanRowProps {
  span: Span;
  /** Depth indent (×3 in the Figma set; unbounded here). */
  depth: number;
  /** Series color index for the span's service (stable per trace). */
  colorIndex: number;
  /** Bar geometry as fractions of the trace duration. */
  offsetFrac: number;
  widthFrac: number;
  selected?: boolean;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
  className?: string;
}

function formatNs(ns: number): string {
  const ms = ns / 1e6;
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}

/**
 * SpanRow — §8.2: depth indent · service color (series/n) · status ok/error
 * · default/hover/selected; duration label pops on hover (MI-7).
 */
export function SpanRow({
  span,
  depth,
  colorIndex,
  offsetFrac,
  widthFrac,
  selected = false,
  onSelect,
  onHover,
  className,
}: SpanRowProps) {
  const color = `var(--color-series-${(colorIndex % 8) + 1})`;
  return (
    <button
      type="button"
      data-status={span.status}
      data-selected={selected || undefined}
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={clsx(
        "font-ui group flex h-7 w-full items-center gap-2 border-b border-border px-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        selected ? "bg-bg-elev" : "hover:bg-bg-elev",
        className,
      )}
    >
      <span
        className="flex w-56 shrink-0 items-center gap-1.5 truncate"
        style={{ paddingLeft: depth * 12 }}
      >
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[1px]"
          style={{ background: color }}
        />
        <span className="truncate text-[12px] text-text">{span.name}</span>
      </span>
      <span className="w-20 shrink-0 truncate text-[11px] text-text-2">{span.service}</span>
      <span className="relative h-3 min-w-0 flex-1 rounded-[1px] bg-bg">
        <span
          className={clsx("absolute inset-y-0 rounded-[1px]", span.status === "error" && "outline outline-1 outline-crit")}
          style={{
            left: `${offsetFrac * 100}%`,
            width: `${Math.max(widthFrac * 100, 0.5)}%`,
            background: color,
          }}
        />
      </span>
      <span
        className={clsx(
          "font-data w-16 shrink-0 text-right text-[11px] tabular-nums",
          span.status === "error" ? "text-crit" : "text-text-2",
          "transition-transform duration-[var(--duration-fast)] ease-standard group-hover:scale-105 motion-reduce:transition-none",
        )}
      >
        {formatNs(span.duration_ns)}
      </span>
    </button>
  );
}
