"use client";

import { clsx } from "clsx";
import { useMemo, useRef, useState } from "react";
import type { Series } from "@/models";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export type TimeseriesMode = "line" | "area" | "bars";

export interface TimeseriesPanelProps {
  title: string;
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
  className?: string;
}

const PLOT_W = 600;
const PAD_L = 44;
const PAD_B = 18;
const PAD_T = 6;

function seriesColor(i: number): string {
  return `var(--color-series-${(i % 8) + 1})`;
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

function formatTime(ts: string): string {
  // hh:mm in UTC — bucketing renders UTC per X-10.
  return ts.slice(11, 16);
}

/**
 * TimeseriesPanel — §3/§8.2: bespoke SVG line/area/bars, legend with
 * per-series toggle, synced crosshair (MI-2), loading (axis-first) and
 * empty (radar MI-16) states. Bars inset clear of the axis labels
 * (as-built note, §8.2).
 */
export function TimeseriesPanel({
  title,
  query,
  series,
  mode = "line",
  withLegend = true,
  loading = false,
  height = 160,
  cursor = null,
  onCursorChange,
  className,
}: TimeseriesPanelProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [localCursor, setLocalCursor] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cursorFrac = cursor ?? localCursor;

  const visible = series.filter((s) => !hidden.has(s.name));
  const plotH = height;
  const innerW = PLOT_W - PAD_L - 8;
  const innerH = plotH - PAD_T - PAD_B;

  const { min, max } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of visible) {
      for (const p of s.points) {
        if (p.value === null) continue;
        lo = Math.min(lo, p.value);
        hi = Math.max(hi, p.value);
      }
    }
    if (!Number.isFinite(lo)) return { min: 0, max: 1 };
    if (lo === hi) return { min: lo - 1, max: hi + 1 };
    return { min: Math.min(lo, 0), max: hi * 1.05 };
  }, [visible]);

  const x = (i: number, n: number) => PAD_L + (i / Math.max(n - 1, 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - ((v - min) / (max - min)) * innerH;

  const n = visible[0]?.points.length ?? 0;
  const cursorIndex =
    cursorFrac !== null && n > 0 ? Math.round(cursorFrac * (n - 1)) : null;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = (e.clientX - rect.left) / rect.width;
    const frac = Math.max(
      0,
      Math.min(1, (fx * PLOT_W - PAD_L) / innerW),
    );
    setLocalCursor(frac);
    onCursorChange?.(frac);
  };

  const handleLeave = () => {
    setLocalCursor(null);
    onCursorChange?.(null);
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
        "font-ui flex w-full flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      {/* stacked header — the master (Figma 50:100) and every landing v2
          instance put the query chip on its own line under the title */}
      <header className="flex flex-col items-start gap-2">
        <h3 className="text-[16px] font-semibold text-text">{title}</h3>
        {query && (
          // max-w-full + truncate: long queries clip inside the panel in
          // narrow contexts (375w home hero); fixed-width panels unchanged
          <code className="font-data max-w-full truncate rounded-(--radius) border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text-2">
            {query}
          </code>
        )}
      </header>

      {loading ? (
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
        >
          {/* y grid + axis labels (11px, §2 ramp) */}
          {[0, 0.5, 1].map((t) => {
            const v = min + (max - min) * t;
            return (
              <g key={t}>
                <line
                  x1={PAD_L}
                  x2={PLOT_W - 8}
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
                  {formatValue(v)}
                </text>
              </g>
            );
          })}

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

          {/* series */}
          {visible.map((s, si) => {
            const pts = s.points;
            const color = seriesColor(series.indexOf(s));
            if (mode === "bars") {
              const bw = Math.max((innerW / Math.max(pts.length, 1)) * 0.7, 1);
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
                        fill={color}
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
                <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
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
        </svg>
      )}

      {/* crosshair tooltip values */}
      {!loading && !empty && cursorIndex !== null && (
        <div className="font-data flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] tabular-nums text-text-2">
          {visible.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              <span
                className="size-1.5 rounded-full"
                style={{ background: seriesColor(series.indexOf(s)) }}
              />
              {s.points[cursorIndex]?.value === null
                ? "—"
                : formatValue(s.points[cursorIndex]?.value ?? 0)}
            </span>
          ))}
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
              className={clsx(
                "inline-flex items-center gap-1.5 text-[11px] transition-opacity duration-[var(--duration-fast)]",
                hidden.has(s.name) ? "opacity-40" : "opacity-100",
              )}
            >
              <span className="size-2 rounded-[1px]" style={{ background: seriesColor(i) }} />
              <span className="font-data max-w-48 truncate text-text-2">{s.name}</span>
            </button>
          ))}
        </footer>
      )}
    </section>
  );
}
