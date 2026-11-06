import { clsx } from "clsx";
import type { Series } from "@/models";
import {
  formatTimeSeconds,
  formatValue,
  legendLabel,
  seriesColor,
} from "./timeseries-format";
import { INNER_WIDTH, PAD_L, PLOT_W } from "./timeseries-geometry";

export function TimeseriesTooltip({
  series,
  visible,
  cursorIndex,
  unit,
}: {
  series: Series[];
  visible: Series[];
  cursorIndex: number | null;
  unit?: string;
}) {
  if (cursorIndex === null) return null;
  const points = visible[0]?.points;
  if (!points?.[cursorIndex]) return null;
  const fraction = cursorIndex / Math.max(points.length - 1, 1);
  // Transform-only movement keeps the tooltip from shifting the layout.
  const cursorPct = ((PAD_L + fraction * INNER_WIDTH) / PLOT_W) * 100;
  return (
    <div
      data-testid="crosshair-tooltip"
      className={clsx(
        "font-data pointer-events-none absolute left-0 top-2 z-10 flex flex-col gap-0.5",
        "rounded-(--radius) border border-border bg-bg-elev/95 px-2 py-1.5 text-[11px] tabular-nums shadow-lg",
      )}
      style={{
        transform:
          fraction > 0.55
            ? `translateX(calc(${cursorPct}cqw - 100% - 8px))`
            : `translateX(calc(${cursorPct}cqw + 8px))`,
      }}
    >
      <span className="text-text-2">
        {formatTimeSeconds(points[cursorIndex].ts)}
      </span>
      {visible.map((s) => {
        const value = s.points[cursorIndex]?.value;
        return (
          <span
            key={s.name}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-text"
            title={s.name}
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: seriesColor(series.indexOf(s)) }}
            />
            {/* MI-2 "per-series values" — a bare number row wasn't
                      attributable to a series; carry the short label */}
            {visible.length > 1 && (
              <span className="max-w-32 truncate text-text-2">
                {legendLabel(s.name)}
              </span>
            )}
            {value == null ? "—" : formatValue(value, unit)}
          </span>
        );
      })}
    </div>
  );
}
