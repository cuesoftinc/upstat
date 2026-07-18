"use client";

import { clsx } from "clsx";

export interface ServiceMapNodeProps {
  name: string;
  reqPerS: number;
  /** Error rate 0..1 — drawn as the circular ring segment (§3 anatomy). */
  errorRate: number;
  /** Series color index for the service (hexagon stroke, Figma 68:445). */
  colorIndex?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE = 150;
const RING_R = 64; // 128px circle (Figma)
const HEX_R = 48; // 96px hexagon

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function formatReq(reqPerS: number): string {
  return reqPerS >= 1000 ? `${(reqPerS / 1000).toFixed(1)}k` : reqPerS.toFixed(0);
}

/**
 * ServiceMapNode — §8.2 (Figma 68:445): hexagon stroked in the service
 * series color inside a circular border ring; ring segment = error %
 * (crit when erroring, ok sliver otherwise); selected = brand outline +
 * glow (brand at 45%).
 */
export function ServiceMapNode({
  name,
  reqPerS,
  errorRate,
  colorIndex = 0,
  selected = false,
  onClick,
  className,
}: ServiceMapNodeProps) {
  const erroring = errorRate >= 0.05;
  const seriesColor = `var(--color-series-${(colorIndex % 8) + 1})`;
  const circumference = 2 * Math.PI * RING_R;
  const arcLen = Math.max(Math.min(errorRate, 1), 0.005) * circumference;

  return (
    <button
      type="button"
      data-state={selected ? "selected" : erroring ? "erroring" : "healthy"}
      aria-label={`${name}: ${reqPerS.toFixed(1)} req/s, ${(errorRate * 100).toFixed(1)}% errors`}
      onClick={onClick}
      className={clsx(
        "font-ui group inline-flex flex-col items-center transition-transform duration-[var(--duration-fast)] ease-standard hover:scale-[1.03] motion-reduce:transition-none",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: SIZE, height: SIZE }}
        aria-hidden="true"
      >
        {/* base ring — hairline circle (Figma stroke 4 border) */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={4}
        />
        {/* error segment — starts at 12 o'clock */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={erroring ? "var(--color-crit)" : "var(--color-ok)"}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        {/* hexagon in the service series color; brand outline + glow when selected */}
        <polygon
          points={hexPoints(SIZE / 2, SIZE / 2, HEX_R)}
          fill="var(--color-bg-elev)"
          stroke={selected ? "var(--color-brand)" : seriesColor}
          strokeWidth={selected ? 2.5 : 2}
          style={
            selected
              ? { filter: "drop-shadow(0 0 8px rgba(0, 224, 158, 0.45))" } // brand glow — effect color not token-bindable (Figma note)
              : undefined
          }
        />
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 8}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          fill="var(--color-text)"
        >
          {name.length > 12 ? `${name.slice(0, 11)}…` : name}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 8}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-2)"
          className="font-data tabular-nums"
        >
          {formatReq(reqPerS)} req/s
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 22}
          textAnchor="middle"
          fontSize={10}
          fill={erroring ? "var(--color-crit)" : "var(--color-text-2)"}
          className="font-data tabular-nums"
        >
          {(errorRate * 100).toFixed(1)}% err
        </text>
      </svg>
    </button>
  );
}
