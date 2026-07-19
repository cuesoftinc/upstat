"use client";

import { clsx } from "clsx";
import type { LogLevel } from "@/models";
import { patternFillStyle, useColorVision } from "@/design/ColorVisionProvider";
import { Tooltip } from "./Tooltip";

export interface LogHistogramProps {
  buckets: { ts: string; counts: Record<LogLevel, number> }[];
  height?: number;
  className?: string;
}

// stacking order bottom→top; tints follow the LevelChip mapping
// (info=brand · debug=text-2 · trace=nodata · warn · error=crit, Figma 75:822;
// TRACE keeps its LevelChip tint here even though the Figma mock stacks four
// levels — data-driven).
const STACK: { level: LogLevel; color: string }[] = [
  { level: "INFO", color: "var(--color-brand)" },
  { level: "DEBUG", color: "var(--color-text-2)" },
  { level: "TRACE", color: "var(--color-nodata)" },
  { level: "WARN", color: "var(--color-warn)" },
  { level: "ERROR", color: "var(--color-crit)" },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * LogHistogram — §8.2: B4 logs-explorer histogram header. Level-stacked
 * volume bars in a bg-elev card with a mono totals header and time axis
 * (Figma 75:646); MI-6 crossfade on facet change.
 */
export function LogHistogram({
  buckets,
  height = 64,
  className,
}: LogHistogramProps) {
  // §5 colorblind mode: level stacks gain stripe overlays (INFO stays
  // solid; the other levels get distinct angles/pitches)
  const { patterns } = useColorVision();
  const totals = buckets.map((b) =>
    STACK.reduce((s, { level }) => s + (b.counts[level] ?? 0), 0),
  );
  const max = Math.max(...totals, 1);
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const errorTotal = buckets.reduce((s, b) => s + (b.counts.ERROR ?? 0), 0);
  const warnTotal = buckets.reduce((s, b) => s + (b.counts.WARN ?? 0), 0);
  const labelIdx = new Set(
    [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * (buckets.length - 1))),
  );

  return (
    <div
      className={clsx(
        "flex w-fit max-w-full flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3.5",
        className,
      )}
    >
      <div className="font-data flex gap-3 text-[12px]">
        <span className="text-text tabular-nums">
          {formatCount(grandTotal)} events
        </span>
        <span className="text-text-2 tabular-nums">
          error {formatCount(errorTotal)} · warn {formatCount(warnTotal)}
        </span>
      </div>

      {/* overflow-x-auto: the fixed-width bars (and their axis labels)
          scroll inside the card on narrow viewports (390 support) */}
      <div className="overflow-x-auto">
        <div className="w-max min-w-full">
          <div
            role="img"
            aria-label="log volume histogram"
            className="flex items-end gap-0.5"
            style={{ height }}
          >
            {buckets.map((bucket, i) => (
              <Tooltip
                key={bucket.ts}
                content={STACK.filter(
                  ({ level }) => (bucket.counts[level] ?? 0) > 0,
                )
                  .reverse()
                  .map(({ level }) => ({
                    label: level,
                    value: String(bucket.counts[level]),
                  }))}
              >
                <span
                  data-ts={bucket.ts}
                  className="flex flex-col-reverse"
                  style={{ width: 6, height }}
                >
                  {STACK.map(({ level, color }, li) => {
                    const v = bucket.counts[level] ?? 0;
                    if (v === 0) return null;
                    return (
                      <span
                        key={level}
                        data-level={level}
                        style={{
                          height: `${(v / max) * 100}%`,
                          opacity: 0.9,
                          ...(patterns
                            ? patternFillStyle(color, li)
                            : { background: color }),
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

          <div className="mt-2 flex justify-between">
            {buckets
              .filter((_, i) => labelIdx.has(i))
              .map((b) => (
                <span
                  key={b.ts}
                  className="font-data text-[11px] tabular-nums text-text-2"
                >
                  {b.ts.slice(11, 16)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
