"use client";

import { clsx } from "clsx";
import type { LogLevel } from "@/models";
import { Tooltip } from "./Tooltip";

export interface LogHistogramProps {
  buckets: { ts: string; counts: Record<LogLevel, number> }[];
  height?: number;
  className?: string;
}

// stacking order bottom→top; tints follow the LevelChip mapping
const STACK: { level: LogLevel; color: string }[] = [
  { level: "INFO", color: "var(--color-brand)" },
  { level: "DEBUG", color: "var(--color-text-2)" },
  { level: "TRACE", color: "var(--color-nodata)" },
  { level: "WARN", color: "var(--color-warn)" },
  { level: "ERROR", color: "var(--color-crit)" },
];

/** LogHistogram — §8.2: level-stacked volume bars over the time axis (B4). */
export function LogHistogram({ buckets, height = 48, className }: LogHistogramProps) {
  const totals = buckets.map((b) =>
    STACK.reduce((s, { level }) => s + (b.counts[level] ?? 0), 0),
  );
  const max = Math.max(...totals, 1);

  return (
    <div
      role="img"
      aria-label="log volume histogram"
      className={clsx("flex w-full items-end gap-px", className)}
      style={{ height }}
    >
      {buckets.map((bucket, i) => (
        <Tooltip
          key={bucket.ts}
          content={STACK.filter(({ level }) => (bucket.counts[level] ?? 0) > 0)
            .reverse()
            .map(({ level }) => ({
              label: level,
              value: String(bucket.counts[level]),
            }))}
        >
          <span
            data-ts={bucket.ts}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            style={{ width: `${100 / buckets.length}%`, height }}
          >
            {STACK.map(({ level, color }) => {
              const v = bucket.counts[level] ?? 0;
              if (v === 0) return null;
              return (
                <span
                  key={level}
                  style={{
                    height: `${(v / max) * 100}%`,
                    background: color,
                    opacity: 0.9,
                  }}
                  className="block w-full"
                />
              );
            })}
            <span className="sr-only">{totals[i]} lines</span>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
