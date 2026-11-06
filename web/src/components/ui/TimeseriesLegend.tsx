import { clsx } from "clsx";
import type { Series } from "@/models";
import {
  patternFillStyle,
  seriesDash,
  useColorVision,
} from "@/design/ColorVisionProvider";
import { legendLabel, seriesColor } from "./timeseries-format";
import type { TimeseriesMode } from "./TimeseriesPanel";

export function TimeseriesLegend({
  series,
  hidden,
  mode,
  onToggle,
}: {
  series: Series[];
  hidden: ReadonlySet<string>;
  mode: TimeseriesMode;
  onToggle: (name: string) => void;
}) {
  const { patterns } = useColorVision();
  return (
    <footer className="flex flex-wrap gap-2">
      {series.map((s, i) => (
        <button
          key={s.name}
          type="button"
          aria-pressed={!hidden.has(s.name)}
          onClick={() => onToggle(s.name)}
          title={s.name}
          className={clsx(
            "inline-flex items-center gap-1.5 text-[11px] transition-opacity duration-[var(--duration-fast)]",
            hidden.has(s.name) ? "opacity-40" : "opacity-100",
          )}
        >
          {/* §5 colorblind mode: the swatch mirrors the series' non-
                  color mark — dash sample for strokes, hatch for bars */}
          {patterns && mode !== "bars" ? (
            <svg width="14" height="4" aria-hidden="true" className="shrink-0">
              <line
                x1="0"
                y1="2"
                x2="14"
                y2="2"
                stroke={seriesColor(i)}
                strokeWidth="2"
                strokeDasharray={seriesDash(i) || undefined}
              />
            </svg>
          ) : (
            <span
              className="size-2 rounded-[1px]"
              style={
                patterns
                  ? patternFillStyle(seriesColor(i), i)
                  : { background: seriesColor(i) }
              }
            />
          )}
          <span className="font-data max-w-48 truncate text-text-2">
            {legendLabel(s.name)}
          </span>
        </button>
      ))}
    </footer>
  );
}
