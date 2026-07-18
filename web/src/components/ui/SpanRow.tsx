"use client";

import { clsx } from "clsx";
import { XCircle } from "lucide-react";
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
 * SpanRow — §8.2 (Figma 64:558): depth indent · series color tick + mono
 * span name · error = 8% crit tint + x-circle + crit bar · selected =
 * brand outline; duration label pops on hover (MI-7).
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
  const error = span.status === "error";
  return (
    <button
      type="button"
      data-status={span.status}
      data-selected={selected || undefined}
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={clsx(
        "font-ui group flex h-7 w-full items-center gap-2 rounded-[3px] px-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        error && "bg-crit/8",
        selected ? "ring-1 ring-inset ring-brand" : "hover:bg-bg-elev",
        className,
      )}
    >
      <span
        className="flex w-56 shrink-0 items-center gap-1.5 truncate"
        style={{ paddingLeft: depth * 12 }}
      >
        {error && <XCircle aria-label="error span" className="size-3 shrink-0 text-crit" />}
        <span
          aria-hidden="true"
          className="h-3.5 w-[3px] shrink-0"
          style={{ background: color }}
        />
        <span className="font-data truncate text-[12px] text-text">{span.name}</span>
      </span>
      <span className="w-20 shrink-0 truncate text-[12px] text-text-2">{span.service}</span>
      <span className="relative h-4 min-w-0 flex-1">
        <span
          className="absolute inset-y-[5px] rounded-[2px]"
          style={{
            left: `${offsetFrac * 100}%`,
            width: `${Math.max(widthFrac * 100, 0.5)}%`,
            background: error ? "var(--color-crit)" : color,
          }}
        />
      </span>
      <span
        className={clsx(
          "font-data w-16 shrink-0 text-right text-[11px] tabular-nums text-text-2",
          "transition-transform duration-[var(--duration-fast)] ease-standard group-hover:scale-105 motion-reduce:transition-none",
        )}
      >
        {formatNs(span.duration_ns)}
      </span>
    </button>
  );
}
