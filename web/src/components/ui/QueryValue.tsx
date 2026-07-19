"use client";

import { clsx } from "clsx";

export type QueryValueThreshold = "none" | "ok" | "warn" | "crit";

export interface QueryValueProps {
  /** Formatted value, e.g. `142 ms` (fixed-precision, §2). */
  value: string;
  label?: string;
  /** Delta vs previous period, e.g. +4.2 (%). */
  deltaPct?: number;
  /** Threshold tint (§8.2). */
  threshold?: QueryValueThreshold;
  /** Sparkline values (bound series/1, Figma 70:537). */
  sparkline?: number[];
  className?: string;
}

// 8% tint-bg card wash per threshold (Figma tint-bg, inset −1px).
const TINT: Record<Exclude<QueryValueThreshold, "none">, string> = {
  ok: "bg-ok/8",
  warn: "bg-warn/8",
  crit: "bg-crit/8",
};

const DELTA_TEXT: Record<Exclude<QueryValueThreshold, "none">, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

/**
 * QueryValue — §8.2 dashboard query-value widget body (Figma 70:537):
 * bg-elev card + threshold tint wash, mono 28 value in text (tint carries
 * the threshold; the value itself stays neutral), mono ▲/▼ delta,
 * series/1 sparkline.
 */
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
      className={clsx(
        // max-w-full + min-w-0: the tile clamps to its widget/grid cell on
        // narrow layouts instead of overflowing (390/768 support)
        "font-ui relative flex w-fit min-w-0 max-w-full flex-col items-start gap-1.5 overflow-hidden",
        "rounded-(--radius) border border-border bg-bg-elev p-4",
        className,
      )}
    >
      {threshold !== "none" && (
        <span
          aria-hidden="true"
          className={clsx(
            "absolute -inset-px rounded-(--radius)",
            TINT[threshold],
          )}
        />
      )}
      {label && (
        <span className="relative text-[12px] text-text-2">{label}</span>
      )}
      <div className="font-data relative flex items-center gap-2.5">
        <span className="text-[28px] leading-none tabular-nums text-text">
          {value}
        </span>
        {deltaPct !== undefined && (
          <span
            className={clsx(
              "text-[12px] tabular-nums",
              threshold !== "none"
                ? DELTA_TEXT[threshold]
                : deltaPct >= 0
                  ? "text-ok"
                  : "text-crit",
            )}
          >
            {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <svg
          viewBox={`0 0 ${sparkline.length - 1} 28`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="relative max-w-full"
          style={{ width: 200, height: 28 }}
        >
          <polyline
            fill="none"
            stroke="var(--color-series-1)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            points={sparkline
              .map((v, i) => {
                const max = Math.max(...sparkline, 1);
                const min = Math.min(...sparkline);
                const range = Math.max(max - min, 1);
                return `${i},${28 - ((v - min) / range) * 24 - 2}`;
              })
              .join(" ")}
          />
        </svg>
      )}
    </div>
  );
}
