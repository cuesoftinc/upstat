"use client";

import { clsx } from "clsx";
import { Tooltip } from "./Tooltip";

export interface HeatmapProps {
  /** Column labels (time buckets). */
  columns: string[];
  /** Row labels (value buckets, top = highest). */
  rows: string[];
  /** values[row][col] — intensity counts. */
  values: number[][];
  className?: string;
}

/** Heatmap — §8.2: time×bucket cell grid, intensity ramp on series/1, hover tooltip. */
export function Heatmap({ columns, rows, values, className }: HeatmapProps) {
  const max = Math.max(...values.flat(), 1);
  return (
    <div className={clsx("font-ui flex gap-1", className)}>
      <div className="flex flex-col justify-between py-0.5 text-right">
        {rows.map((row) => (
          <span key={row} className="font-data text-[11px] tabular-nums text-text-2">
            {row}
          </span>
        ))}
      </div>
      <div
        role="img"
        aria-label="heatmap"
        className="grid flex-1 gap-px"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr))`,
          gridTemplateRows: `repeat(${rows.length}, 14px)`,
          gridAutoFlow: "column",
        }}
      >
        {columns.map((col, ci) =>
          rows.map((row, ri) => {
            const v = values[ri]?.[ci] ?? 0;
            return (
              <Tooltip
                key={`${col}-${row}`}
                content={[
                  { label: `${col} · ${row}`, value: String(v) },
                ]}
              >
                <span
                  data-count={v}
                  className="block size-full rounded-[1px]"
                  style={{
                    background: "var(--color-series-1)",
                    opacity: v === 0 ? 0.06 : 0.15 + (v / max) * 0.85,
                  }}
                />
              </Tooltip>
            );
          }),
        )}
      </div>
    </div>
  );
}
