"use client";

import { clsx } from "clsx";
import { Skeleton } from "./Skeleton";

export interface TopListEntry {
  label: string;
  value: number;
  /** Formatted value override. */
  display?: string;
}

export interface TopListProps {
  entries: TopListEntry[];
  loading?: boolean;
  className?: string;
}

/** TopList — §8.2: ranked horizontal bars ×5 (series palette) + right values. */
export function TopList({ entries, loading = false, className }: TopListProps) {
  if (loading) {
    return (
      <div className={clsx("flex flex-col gap-2", className)}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} kind="line" />
        ))}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <p className={clsx("font-ui text-[12px] text-text-2", className)}>No data in range.</p>
    );
  }
  const max = Math.max(...entries.map((e) => e.value), 1);
  return (
    <ol className={clsx("font-ui flex flex-col gap-1.5", className)}>
      {entries.map((entry, i) => (
        <li key={entry.label} className="flex items-center gap-2">
          <span className="w-36 truncate text-[12px] text-text">{entry.label}</span>
          <span className="relative h-3.5 flex-1 overflow-hidden rounded-[1px] bg-bg">
            <span
              className="absolute inset-y-0 left-0 rounded-[1px]"
              style={{
                width: `${(entry.value / max) * 100}%`,
                background: `var(--color-series-${(i % 8) + 1})`,
              }}
            />
          </span>
          <span className="font-data w-16 shrink-0 text-right text-[12px] tabular-nums text-text-2">
            {entry.display ?? entry.value.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
