"use client";

import { clsx } from "clsx";

export interface ServiceMapNodeProps {
  name: string;
  reqPerS: number;
  /** Error rate 0..1 — drawn as the ring fill (§3 anatomy). */
  errorRate: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE = 112;
const R = 44;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

/**
 * ServiceMapNode — §8.2: hexagon (name + req/s + error-% ring) ·
 * healthy / erroring / selected.
 */
export function ServiceMapNode({
  name,
  reqPerS,
  errorRate,
  selected = false,
  onClick,
  className,
}: ServiceMapNodeProps) {
  const erroring = errorRate >= 0.05;
  const ringLength = 6 * R; // hexagon perimeter approximation for dash math
  const errorLen = Math.min(Math.max(errorRate, 0), 1) * ringLength;

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
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <polygon
          points={hexPoints(SIZE / 2, SIZE / 2, R)}
          fill="var(--color-bg-elev)"
          stroke={selected ? "var(--color-brand)" : "var(--color-border)"}
          strokeWidth={selected ? 2 : 1}
        />
        {/* error ring */}
        <polygon
          points={hexPoints(SIZE / 2, SIZE / 2, R)}
          fill="none"
          stroke={erroring ? "var(--color-crit)" : "var(--color-ok)"}
          strokeWidth={2.5}
          strokeDasharray={`${errorLen === 0 ? ringLength : errorLen} ${ringLength}`}
          opacity={errorRate === 0 ? 0.35 : 1}
        />
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="var(--color-text)"
        >
          {name.length > 12 ? `${name.slice(0, 11)}…` : name}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 12}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-2)"
          className="tabular-nums"
        >
          {reqPerS.toFixed(1)} req/s
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 26}
          textAnchor="middle"
          fontSize={11}
          fill={erroring ? "var(--color-crit)" : "var(--color-text-2)"}
          className="tabular-nums"
        >
          {(errorRate * 100).toFixed(1)}% err
        </text>
      </svg>
    </button>
  );
}
