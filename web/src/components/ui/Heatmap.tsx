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

const CELL = 14; // px — fixed cell size; Tooltip wrappers hug content

/**
 * Heatmap — §8.2: time×bucket cell grid, intensity ramp on series/1,
 * hover tooltip, mono axis labels + time labels below (Figma 73:682).
 */
export function Heatmap({ columns, rows, values, className }: HeatmapProps) {
  const max = Math.max(...values.flat(), 1);
  // sparse x labels: first / quarter / mid / three-quarter / last
  const labelIdx = new Set(
    [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * (columns.length - 1))),
  );
  return (
    // overflow-x-auto: the fixed-cell grid scrolls inside its panel on
    // narrow viewports (390 support); desktop rendering is unchanged
    <div
      className={clsx(
        "font-ui flex w-fit max-w-full gap-1.5 overflow-x-auto",
        className,
      )}
    >
      <div
        className="flex flex-col justify-between py-0.5 text-right"
        style={{ height: rows.length * (CELL + 1) }}
      >
        {rows.map((row) => (
          <span
            key={row}
            className="font-data text-[11px] leading-none tabular-nums text-text-2"
          >
            {row}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <div
          role="img"
          aria-label="heatmap"
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, ${CELL}px)`,
            gridTemplateRows: `repeat(${rows.length}, ${CELL}px)`,
            gridAutoFlow: "column",
          }}
        >
          {columns.map((col, ci) =>
            rows.map((row, ri) => {
              const v = values[ri]?.[ci] ?? 0;
              return (
                <Tooltip
                  key={`${col}-${row}`}
                  content={[{ label: `${col} · ${row}`, value: String(v) }]}
                >
                  <span
                    data-count={v}
                    className="block rounded-[1px]"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: "var(--color-series-1)",
                      opacity: v === 0 ? 0.06 : 0.15 + (v / max) * 0.85,
                    }}
                  />
                </Tooltip>
              );
            }),
          )}
        </div>
        <div className="flex justify-between">
          {columns
            .filter((_, i) => labelIdx.has(i))
            .map((col) => (
              <span
                key={col}
                className="font-data text-[11px] tabular-nums text-text-2"
              >
                {col}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
