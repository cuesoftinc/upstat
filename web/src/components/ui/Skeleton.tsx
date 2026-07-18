"use client";

import { clsx } from "clsx";

export type SkeletonKind = "line" | "value" | "panel-axis";

export interface SkeletonProps {
  /** §8.2b: kind line / value / panel-axis. */
  kind?: SkeletonKind;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Skeleton — the Stage-4 loading-frame primitive (§8.1 three-frame rule).
 * Shimmer sweep; static under prefers-reduced-motion (§5).
 */
export function Skeleton({ kind = "line", className, style }: SkeletonProps) {
  const shimmer =
    "animate-pulse motion-reduce:animate-none bg-bg-elev";
  if (kind === "panel-axis") {
    // axis-first loading: hairline axes + shimmering plot region
    return (
      <div
        data-kind={kind}
        aria-hidden="true"
        style={style}
        className={clsx("relative h-32 w-full", className)}
      >
        <div className="absolute inset-y-0 left-6 w-px bg-border" />
        <div className="absolute inset-x-6 bottom-4 h-px bg-border" />
        <div className={clsx("absolute inset-x-8 top-2 bottom-6 rounded-(--radius)", shimmer)} />
      </div>
    );
  }
  return (
    <span
      data-kind={kind}
      aria-hidden="true"
      style={style}
      className={clsx(
        "block rounded-(--radius)",
        shimmer,
        kind === "line" && "h-3.5 w-full",
        kind === "value" && "h-7 w-20",
        className,
      )}
    />
  );
}
