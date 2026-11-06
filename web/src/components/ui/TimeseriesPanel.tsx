"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Series } from "@/models";
import { ChartDataTable, ChartTableToggle } from "./ChartTable";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { TimeseriesLegend } from "./TimeseriesLegend";
import { TimeseriesPlot } from "./TimeseriesPlot";
import {
  deriveUnit,
  formatTime,
  formatValue,
  legendLabel,
} from "./timeseries-format";

export { PLOT_W, PAD_L, PAD_R, PAD_B, PAD_T } from "./timeseries-geometry";

export type TimeseriesMode = "line" | "area" | "bars";

export interface TimeseriesPanelProps {
  title: string;
  /**
   * Element for the panel title. Defaults to h3 (dashboard context). Pass
   * "p" where the panel is illustrative (marketing surfaces) so demo chart
   * titles don't enter the page's heading outline — the home hero's h3
   * directly after the page h1 was a heading-level skip.
   */
  titleAs?: "h2" | "h3" | "h4" | "p";
  /** Query chip text (mono). */
  query?: string;
  series: Series[];
  mode?: TimeseriesMode;
  withLegend?: boolean;
  loading?: boolean;
  /** Height of the plot region in px. */
  height?: number;
  /** External crosshair sync (MI-2): fraction 0..1 or null. */
  cursor?: number | null;
  onCursorChange?: (fraction: number | null) => void;
  /**
   * MI-3 drag-to-zoom: dragging a horizontal region reports its bounds as
   * fractions 0..1 of the plotted range; the controller converts to time.
   */
  onZoomRange?: (fromFrac: number, toFrac: number) => void;
  /** MI-3: double-click resets the zoom stack. */
  onZoomReset?: () => void;
  /**
   * false = bare plot (no title/query header, border or panel bg) — the
   * WidgetShell provides the chrome when the panel is a dashboard widget.
   */
  chrome?: boolean;
  /**
   * Y-label unit suffix ("600 ms" ladder, master 50:407; zero stays bare).
   * Defaults to a sniff of the series/query metric name (`*_ms` → "ms").
   */
  unit?: string;
  className?: string;
}

/**
 * TimeseriesPanel — §3/§8.2: bespoke SVG line/area/bars, legend with
 * per-series toggle, synced crosshair (MI-2), loading (axis-first) and
 * empty (radar MI-16) states. Bars inset clear of the axis labels
 * (as-built note, §8.2).
 */
export function TimeseriesPanel({
  title,
  titleAs: TitleTag = "h3",
  query,
  series,
  mode = "line",
  withLegend = true,
  loading = false,
  height = 160,
  cursor = null,
  onCursorChange,
  onZoomRange,
  onZoomReset,
  chrome = true,
  unit: unitProp,
  className,
}: TimeseriesPanelProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showTable, setShowTable] = useState(false);
  const visible = useMemo(
    () => series.filter((s) => !hidden.has(s.name)),
    [series, hidden],
  );
  const unit = unitProp ?? deriveUnit(series, query);

  const toggleSeries = (name: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Empty = no data at all — hiding every series via the legend must NOT
  // flip the panel into the MI-16 empty state (the legend stays operable).
  const empty =
    !loading &&
    (series.length === 0 || series.every((s) => s.points.length === 0));

  return (
    <section
      data-mode={mode}
      className={clsx(
        "font-ui relative flex w-full flex-col gap-2",
        chrome && "rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      {/* stacked header — the master (Figma 50:100) and every landing v2
          instance put the query chip on its own line under the title */}
      {chrome && (
        <header className="flex flex-col items-start gap-2">
          <div className="flex w-full items-center gap-2">
            <TitleTag className="min-w-0 flex-1 truncate text-[16px] font-semibold text-text">
              {title}
            </TitleTag>
            {!loading && !empty && (
              <ChartTableToggle
                active={showTable}
                onToggle={() => setShowTable((v) => !v)}
              />
            )}
          </div>
          {query && (
            // max-w-full + truncate: long queries clip inside the panel in
            // narrow contexts (375w home hero); fixed-width panels unchanged
            <code className="font-data max-w-full truncate rounded-(--radius) border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text-2">
              {query}
            </code>
          )}
        </header>
      )}

      {/* bare plots (dashboard widgets — WidgetShell owns the chrome) keep
          the affordance as a floating corner control over the plot */}
      {!chrome && !loading && !empty && (
        <ChartTableToggle
          active={showTable}
          onToggle={() => setShowTable((v) => !v)}
          className="absolute right-0 top-0 z-10"
        />
      )}

      {showTable && !loading && !empty ? (
        <TimeseriesDataTable visible={visible} unit={unit} height={height} />
      ) : loading ? (
        // height via style — a template-built `h-[…]` class never reaches
        // Tailwind's scanner, so it emitted no CSS
        <Skeleton kind="panel-axis" style={{ height: height }} />
      ) : empty ? (
        <EmptyState
          pillar="metrics"
          compact
          className="border-0 bg-transparent p-0"
        />
      ) : (
        <TimeseriesPlot
          title={title}
          series={series}
          visible={visible}
          mode={mode}
          height={height}
          unit={unit}
          cursor={cursor}
          onCursorChange={onCursorChange}
          onZoomRange={onZoomRange}
          onZoomReset={onZoomReset}
        />
      )}

      {/* loading holds one legend-row of space — the legend materializing
          under the plot nudged everything below the panel (CLS) */}
      {withLegend && loading && (
        <footer aria-hidden="true" className="min-h-3.5" />
      )}
      {withLegend && !empty && !loading && (
        <TimeseriesLegend
          series={series}
          hidden={hidden}
          mode={mode}
          onToggle={toggleSeries}
        />
      )}
    </section>
  );
}

function TimeseriesDataTable({
  visible,
  unit,
  height,
}: {
  visible: Series[];
  unit?: string;
  height: number;
}) {
  // §5 data-table alternative — time column + one column per visible
  // series (legend labels); hidden series stay hidden here too
  const tableColumns = [
    { key: "ts", label: "Time" },
    ...visible.map((s, si) => ({
      key: `s${si}`,
      label: legendLabel(s.name),
      numeric: true,
    })),
  ];
  const tableRows = (visible[0]?.points ?? []).map((p, ri) => {
    const row: Record<string, string | number | null> = {
      ts: formatTime(p.ts),
    };
    visible.forEach((s, si) => {
      const v = s.points[ri]?.value;
      row[`s${si}`] =
        v === null || v === undefined ? null : formatValue(v, unit);
    });
    return row;
  });

  return (
    <ChartDataTable
      columns={tableColumns}
      rows={tableRows}
      maxHeight={height}
    />
  );
}
