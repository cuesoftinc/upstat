import { useId } from "react";
import type { Series } from "@/models";
import { seriesDash } from "@/design/ColorVisionProvider";
import { seriesColor } from "./timeseries-format";
import { INNER_WIDTH, PAD_T } from "./timeseries-geometry";
import type { TimeseriesMode } from "./TimeseriesPanel";

export function TimeseriesMarks({
  series,
  visible,
  mode,
  patterns,
  cursorIndex,
  innerH,
  x,
  y,
}: {
  series: Series[];
  visible: Series[];
  mode: TimeseriesMode;
  patterns: boolean;
  cursorIndex: number | null;
  innerH: number;
  x: (index: number, count: number) => number;
  y: (value: number) => number;
}) {
  const uid = useId();
  const barPatternId = (i: number) => `${uid}-bar-${i}`;
  return (
    <>
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
        const seriesIndex = series.indexOf(s);
        const color = seriesColor(seriesIndex);
        if (mode === "bars") {
          const bw = Math.max((INNER_WIDTH / Math.max(pts.length, 1)) * 0.7, 1);
          const fill = patterns ? `url(#${barPatternId(seriesIndex)})` : color;
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
        const cursorValue =
          cursorIndex === null ? null : pts[cursorIndex]?.value;
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
                patterns ? seriesDash(seriesIndex) || undefined : undefined
              }
            />
            {/* crosshair value dots (MI-2) */}
            {cursorIndex !== null && cursorValue != null && (
              <circle
                cx={x(cursorIndex, pts.length)}
                cy={y(cursorValue)}
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
    </>
  );
}
