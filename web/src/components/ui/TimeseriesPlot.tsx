import { useMemo } from "react";
import type { Series } from "@/models";
import { useColorVision } from "@/design/ColorVisionProvider";
import { plotScale } from "@/design/chart-scale";
import { TimeseriesMarks } from "./TimeseriesMarks";
import { TimeseriesTooltip } from "./TimeseriesTooltip";
import { formatTime, formatValue } from "./timeseries-format";
import {
  INNER_WIDTH,
  PAD_B,
  PAD_L,
  PAD_R,
  PAD_T,
  PLOT_W,
} from "./timeseries-geometry";
import { useTimeseriesInteraction } from "./use-timeseries-interaction";
import type { TimeseriesMode, TimeseriesPanelProps } from "./TimeseriesPanel";

type TimeseriesPlotProps = Pick<
  TimeseriesPanelProps,
  | "title"
  | "series"
  | "cursor"
  | "onCursorChange"
  | "onZoomRange"
  | "onZoomReset"
> & {
  visible: Series[];
  mode: TimeseriesMode;
  height: number;
  unit?: string;
};

export function TimeseriesPlot({
  title,
  series,
  visible,
  mode,
  height: plotH,
  unit,
  cursor,
  onCursorChange,
  onZoomRange,
  onZoomReset,
}: TimeseriesPlotProps) {
  const { patterns } = useColorVision();
  const { localCursor, drag, svgProps } = useTimeseriesInteraction({
    onCursorChange,
    onZoomRange,
    onZoomReset,
  });
  const cursorFrac = cursor ?? localCursor;
  const innerH = plotH - PAD_T - PAD_B;

  // 4 zero-based nice ticks per the master ladder (0/200/400/600 ms —
  // Figma 50:407; the [0, 0.5, 1] max/mid/min axis was drift)
  const { ticks, domainMin, domainMax } = useMemo(
    () =>
      plotScale(
        visible.flatMap((s) =>
          s.points.flatMap((p) => (p.value === null ? [] : [p.value])),
        ),
      ),
    [visible],
  );

  const x = (i: number, n: number) =>
    PAD_L + (i / Math.max(n - 1, 1)) * INNER_WIDTH;
  const y = (v: number) =>
    PAD_T + innerH - ((v - domainMin) / (domainMax - domainMin)) * innerH;

  const n = visible[0]?.points.length ?? 0;
  const cursorIndex =
    cursorFrac !== null && n > 0 ? Math.round(cursorFrac * (n - 1)) : null;

  return (
    <div className="@container relative min-w-0">
      <svg
        {...svgProps}
        viewBox={`0 0 ${PLOT_W} ${plotH}`}
        role="img"
        aria-label={`${title} chart`}
        // min-w-0: the viewBox's intrinsic 600px must not set the panel's
        // min-content width (375w home); rendering at fixed widths unchanged
        className="w-full min-w-0"
        style={{ height: plotH }}
        data-testid="timeseries-plot"
      >
        {/* y grid + axis labels (11px, §2 ramp) — 4 zero-based unit-
              suffixed ticks per the master (50:407) */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={PLOT_W - PAD_R}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-text-2)"
              className="font-data tabular-nums"
            >
              {formatValue(v, unit)}
            </text>
          </g>
        ))}

        {/* x-axis time labels (mono 11, §2 ramp — Figma 50:100) */}
        {visible[0] &&
          [0, 0.25, 0.5, 0.75, 1].map((t) => {
            const pts = visible[0].points;
            const idx = Math.round(t * (pts.length - 1));
            const ts = pts[idx]?.ts;
            if (!ts) return null;
            return (
              <text
                key={`x${t}`}
                x={PAD_L + t * INNER_WIDTH}
                y={plotH - 4}
                textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--color-text-2)"
                className="font-data tabular-nums"
              >
                {formatTime(ts)}
              </text>
            );
          })}
        <TimeseriesMarks
          series={series}
          visible={visible}
          mode={mode}
          patterns={patterns}
          cursorIndex={cursorIndex}
          innerH={innerH}
          x={x}
          y={y}
        />
        {/* MI-3 drag-to-zoom selection region */}
        {drag && Math.abs(drag.to - drag.from) > 0 && (
          <rect
            x={PAD_L + Math.min(drag.from, drag.to) * INNER_WIDTH}
            y={PAD_T}
            width={Math.abs(drag.to - drag.from) * INNER_WIDTH}
            height={innerH}
            fill="var(--color-brand)"
            opacity={0.12}
            stroke="var(--color-brand)"
            strokeWidth={1}
            data-testid="zoom-selection"
          />
        )}
      </svg>
      <TimeseriesTooltip
        series={series}
        visible={visible}
        cursorIndex={cursorIndex}
        unit={unit}
      />
    </div>
  );
}
