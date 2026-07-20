"use client";

import { clsx } from "clsx";

export interface FunnelStageCardProps {
  label: string;
  count: number;
  /** Share of the previous stage (first stage = 100). */
  pctOfPrevious: number;
  className?: string;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * FunnelStageCard — design.md §8.2b: stage label · count (PageTitle/20,
 * tnum) · share-of-previous meta; stages compose with "→" connectors
 * (Figma "B6 — RUM analytics drill-down (U6-2)").
 */
export function FunnelStageCard({
  label,
  count,
  pctOfPrevious,
  className,
}: FunnelStageCardProps) {
  return (
    <div
      className={clsx(
        "font-ui flex min-w-56 flex-col gap-1.5 rounded-(--radius) border border-border bg-bg-elev px-5 py-4",
        className,
      )}
    >
      <span className="text-[12px] text-text-2">{label}</span>
      <span className="font-data text-[20px] font-semibold tabular-nums text-text">
        {fmtCount(count)}
      </span>
      <span className="font-data text-[12px] tabular-nums text-text-2">
        {pctOfPrevious}% of previous stage
      </span>
    </div>
  );
}
