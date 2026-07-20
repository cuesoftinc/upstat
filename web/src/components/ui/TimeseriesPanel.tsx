"use client";

import { clsx } from "clsx";
import { useId, useMemo, useRef, useState } from "react";
import type { Series } from "@/models";
import {
  patternFillStyle,
  seriesDash,
  useColorVision,
} from "@/design/ColorVisionProvider";
import { plotScale } from "@/design/chart-scale";
import { ChartDataTable, ChartTableToggle } from "./ChartTable";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

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

/** Plot geometry — exported so ReplayPanel's overlay math shares it. */
export const PLOT_W = 600;
export const PAD_L = 56; // fits unit-suffixed labels ("600 ms")
export const PAD_R = 8;
export const PAD_B = 18;
export const PAD_T = 6;

function seriesColor(i: number): string {
  return `var(--color-series-${(i % 8) + 1})`;
}

function formatValue(v: number, unit?: string): string {
  const compact =
    Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : // ≥100 the fractional digit is axis noise ("520 ms", not "520.2 ms")
        Math.abs(v) >= 100
        ? String(Math.round(v))
        : v % 1 === 0
          ? String(v)
          : v.toFixed(1);
  // unit suffix per the master ladder — the zero tick stays bare "0"
  return unit && v !== 0 ? `${compact} ${unit}` : compact;
}

/** Unit sniff for the default: seeded metric names carry `*_ms`. */
function deriveUnit(series: Series[], query?: string): string | undefined {
  const haystack = `${series[0]?.name ?? ""} ${query ?? ""}`;
  return /_ms\b/.test(haystack) ? "ms" : undefined;
}

function formatTime(ts: string): string {
  // hh:mm in UTC — bucketing renders UTC per X-10.
  return ts.slice(11, 16);
}

function formatTimeSeconds(ts: string): string {
  // hh:mm:ss for the crosshair tooltip header (master 50:407: "14:32:00").
  return ts.slice(11, 19);
}

/**
 * Legend label — the DISTINGUISHING part of a series name. Grouped query
 * names ("p95(http.request.duration_ms) service:api-common") all share the
 * fn(metric) prefix; truncating from the right rendered eight identical
 * legend entries (system-QA finding 2026-07-19). Prefer the tag suffix;
 * the full name stays on the title tooltip.
 */
function legendLabel(name: string): string {
  const idx = name.indexOf(") ");
  if (idx === -1) return name;
  // The master's label idiom keeps only the tag VALUES ("api-common", not
  // "service:api-common") — for by-<tag> groups the key is shared by every
  // entry, so it distinguishes nothing (adjudicated 2026-07-20).
  return name
    .slice(idx + 2)
    .split(/\s+/)
    .map((pair) => {
      const colon = pair.indexOf(":");
      return colon === -1 ? pair : pair.slice(colon + 1);
    })
    .join(" ");
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
  const [localCursor, setLocalCursor] = useState<number | null>(null);
  // §5 colorblind mode: dash arrays on strokes, hatch patterns on bars
  const { patterns } = useColorVision();
  const uid = useId();
  const barPatternId = (i: number) => `${uid}-bar-${i}`;
  // §5: every chart exposes a data-table alternative
  const [showTable, setShowTable] = useState(false);
  /** MI-3 drag selection, fractions of the plot width. */
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorFrac = cursor ?? localCursor;

  const visible = series.filter((s) => !hidden.has(s.name));
  const plotH = height;
  const innerW = PLOT_W - PAD_L - PAD_R;
  const innerH = plotH - PAD_T - PAD_B;
  const unit = unitProp ?? deriveUnit(series, query);

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

  const x = (i: number, n: number) => PAD_L + (i / Math.max(n - 1, 1)) * innerW;
  const y = (v: number) =>
    PAD_T + innerH - ((v - domainMin) / (domainMax - domainMin)) * innerH;

  const n = visible[0]?.points.length ?? 0;
  const cursorIndex =
    cursorFrac !== null && n > 0 ? Math.round(cursorFrac * (n - 1)) : null;

  const fracAt = (clientX: number): number | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const fx = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, (fx * PLOT_W - PAD_L) / innerW));
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const frac = fracAt(e.clientX);
    if (frac === null) return;
    if (dragging.current) {
      setDrag((d) => (d ? { ...d, to: frac } : d));
      return;
    }
    setLocalCursor(frac);
    onCursorChange?.(frac);
  };

  const handleLeave = () => {
    setLocalCursor(null);
    onCursorChange?.(null);
    dragging.current = false;
    setDrag(null);
  };

  const handleDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onZoomRange) return;
    const frac = fracAt(e.clientX);
    if (frac === null) return;
    dragging.current = true;
    setDrag({ from: frac, to: frac });
  };

  const handleUp = () => {
    if (!dragging.current || !drag) return;
    dragging.current = false;
    const lo = Math.min(drag.from, drag.to);
    const hi = Math.max(drag.from, drag.to);
    setDrag(null);
    // ignore sub-2% drags — that's a click, not a zoom
    if (hi - lo >= 0.02) onZoomRange?.(lo, hi);
  };

  // Empty = no data at all — hiding every series via the legend must NOT
  // flip the panel into the MI-16 empty state (the legend stays operable).
  const empty =
    !loading &&
    (series.length === 0 || series.every((s) => s.points.length === 0));

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
        <ChartDataTable
          columns={tableColumns}
          rows={tableRows}
          maxHeight={plotH}
        />
      ) : loading ? (
        // height via style — a template-built `h-[…]` class never reaches
        // Tailwind's scanner, so it emitted no CSS
        <Skeleton kind="panel-axis" style={{ height: plotH }} />
      ) : empty ? (
        <EmptyState
          pillar="metrics"
          compact
          className="border-0 bg-transparent p-0"
        />
      ) : (
        <div className="relative min-w-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${PLOT_W} ${plotH}`}
            role="img"
            aria-label={`${title} chart`}
            // min-w-0: the viewBox's intrinsic 600px must not set the panel's
            // min-content width (375w home); rendering at fixed widths unchanged
            className="w-full min-w-0"
            style={{ height: plotH }}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onMouseDown={handleDown}
            onMouseUp={handleUp}
            onDoubleClick={onZoomReset}
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
                    x={PAD_L + t * innerW}
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

            {/* §5 colorblind mode: per-series hatch patterns for bar fills —
              angle/pitch vary by index, index 0 stays solid */}
            {patterns && mode === "bars" && (
              <defs>
                {series.map((s, i) => (
                  <pattern
                    key={s.name}
                    id={barPatternId(i)}
                    width={5}
                    height={5}
                    patternUnits="userSpaceOnUse"
                    patternTransform={`rotate(${[0, 45, 135, 90, 25, 115, 65, 155][i % 8]})`}
                  >
                    <rect width={5} height={5} fill={seriesColor(i)} />
                    {i % 8 !== 0 && (
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={5}
                        stroke="var(--color-bg-elev)"
                        strokeWidth={1.75}
                      />
                    )}
                  </pattern>
                ))}
              </defs>
            )}

            {/* series */}
            {visible.map((s, si) => {
              const pts = s.points;
              const color = seriesColor(series.indexOf(s));
              if (mode === "bars") {
                const bw = Math.max(
                  (innerW / Math.max(pts.length, 1)) * 0.7,
                  1,
                );
                const fill = patterns
                  ? `url(#${barPatternId(series.indexOf(s))})`
                  : color;
                return (
                  <g key={s.name}>
                    {pts.map((p, i) =>
                      p.value === null ? null : (
                        <rect
                          key={i}
                          x={x(i, pts.length) - bw / 2}
                          y={y(p.value)}
                          width={bw}
                          height={Math.max(PAD_T + innerH - y(p.value), 0)}
                          fill={fill}
                          opacity={0.85}
                        />
                      ),
                    )}
                  </g>
                );
              }
              const path = pts
                .map((p, i) =>
                  p.value === null
                    ? null
                    : `${i === 0 || pts[i - 1]?.value === null ? "M" : "L"}${x(i, pts.length)},${y(p.value)}`,
                )
                .filter(Boolean)
                .join(" ");
              return (
                <g key={s.name}>
                  {mode === "area" && (
                    <path
                      d={`${path} L${x(pts.length - 1, pts.length)},${PAD_T + innerH} L${x(0, pts.length)},${PAD_T + innerH} Z`}
                      fill={color}
                      opacity={0.15}
                    />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    // §5 colorblind mode: series-index dash arrays (first
                    // series stays solid)
                    strokeDasharray={
                      patterns
                        ? seriesDash(series.indexOf(s)) || undefined
                        : undefined
                    }
                  />
                  {/* crosshair value dots (MI-2) */}
                  {cursorIndex !== null && pts[cursorIndex]?.value !== null && (
                    <circle
                      cx={x(cursorIndex, pts.length)}
                      cy={y(pts[cursorIndex].value!)}
                      r={2.5}
                      fill={color}
                    />
                  )}
                  {si === 0 && cursorIndex !== null && (
                    <line
                      x1={x(cursorIndex, pts.length)}
                      x2={x(cursorIndex, pts.length)}
                      y1={PAD_T}
                      y2={PAD_T + innerH}
                      stroke="var(--color-text-2)"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  )}
                </g>
              );
            })}

            {/* MI-3 drag-to-zoom selection region */}
            {drag && Math.abs(drag.to - drag.from) > 0 && (
              <rect
                x={PAD_L + Math.min(drag.from, drag.to) * innerW}
                y={PAD_T}
                width={Math.abs(drag.to - drag.from) * innerW}
                height={innerH}
                fill="var(--color-brand)"
                opacity={0.12}
                stroke="var(--color-brand)"
                strokeWidth={1}
                data-testid="zoom-selection"
              />
            )}
          </svg>

          {/* crosshair tooltip — FLOATING at the crosshair inside the plot,
              led by the timestamp (master 50:407 crosshair variant:
              "14:32:00 · p50 84 ms · …"); flips sides past plot center so
              it never leaves the panel */}
          {cursorIndex !== null && visible[0]?.points[cursorIndex] && (
            <div
              data-testid="crosshair-tooltip"
              className={clsx(
                "font-data pointer-events-none absolute top-2 z-10 flex flex-col gap-0.5",
                "rounded-(--radius) border border-border bg-bg-elev/95 px-2 py-1.5 text-[11px] tabular-nums shadow-lg",
              )}
              style={{
                left: `${((PAD_L + (cursorIndex / Math.max(n - 1, 1)) * innerW) / PLOT_W) * 100}%`,
                transform:
                  cursorIndex / Math.max(n - 1, 1) > 0.55
                    ? "translateX(calc(-100% - 8px))"
                    : "translateX(8px)",
              }}
            >
              <span className="text-text-2">
                {formatTimeSeconds(visible[0].points[cursorIndex].ts)}
              </span>
              {visible.map((s) => (
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
                  {s.points[cursorIndex]?.value === null
                    ? "—"
                    : formatValue(s.points[cursorIndex]?.value ?? 0, unit)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {withLegend && !empty && !loading && (
        <footer className="flex flex-wrap gap-2">
          {series.map((s, i) => (
            <button
              key={s.name}
              type="button"
              aria-pressed={!hidden.has(s.name)}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.name)) next.delete(s.name);
                  else next.add(s.name);
                  return next;
                })
              }
              title={s.name}
              className={clsx(
                "inline-flex items-center gap-1.5 text-[11px] transition-opacity duration-[var(--duration-fast)]",
                hidden.has(s.name) ? "opacity-40" : "opacity-100",
              )}
            >
              {/* §5 colorblind mode: the swatch mirrors the series' non-
                  color mark — dash sample for strokes, hatch for bars */}
              {patterns && mode !== "bars" ? (
                <svg
                  width="14"
                  height="4"
                  aria-hidden="true"
                  className="shrink-0"
                >
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
      )}
    </section>
  );
}
