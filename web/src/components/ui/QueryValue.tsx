"use client";

import { clsx } from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";

export type QueryValueThreshold = "none" | "ok" | "warn" | "crit";

export interface QueryValueProps {
  /** Formatted value, e.g. `142 ms` (fixed-precision, §2). */
  value: string;
  label?: string;
  /** Delta vs previous period, e.g. +4.2 (%). */
  deltaPct?: number;
  /** Threshold tint (§8.2). */
  threshold?: QueryValueThreshold;
  /** Sparkline values. */
  sparkline?: number[];
  className?: string;
}

/** QueryValue — §8.2: big tabular value + delta chip · threshold tint · sparkline. */
export function QueryValue({
  value,
  label,
  deltaPct,
  threshold = "none",
  sparkline,
  className,
}: QueryValueProps) {
  return (
    <div
      data-threshold={threshold}
      className={clsx("font-ui flex flex-col items-start gap-1", className)}
    >
      {label && <span className="text-[12px] text-text-2">{label}</span>}
      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "font-data text-[28px] font-semibold tabular-nums leading-none",
            threshold === "none" && "text-text",
            threshold === "ok" && "text-ok",
            threshold === "warn" && "text-warn",
            threshold === "crit" && "text-crit",
          )}
        >
          {value}
        </span>
        {deltaPct !== undefined && (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums",
              deltaPct >= 0 ? "text-ok" : "text-crit",
            )}
          >
            {deltaPct >= 0 ? (
              <TrendingUp className="size-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3" aria-hidden="true" />
            )}
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <svg
          viewBox={`0 0 ${sparkline.length - 1} 20`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ width: 96, height: 20 }}
        >
          <polyline
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            points={sparkline
              .map((v, i) => {
                const max = Math.max(...sparkline, 1);
                const min = Math.min(...sparkline);
                const range = Math.max(max - min, 1);
                return `${i},${20 - ((v - min) / range) * 16 - 2}`;
              })
              .join(" ")}
          />
        </svg>
      )}
    </div>
  );
}
