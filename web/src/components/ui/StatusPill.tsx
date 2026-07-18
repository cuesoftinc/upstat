"use client";

import { clsx } from "clsx";

/** §8.2: ok / warn / crit (breathing) / nodata / paused / pending. */
export type StatusPillStatus =
  | "ok"
  | "warn"
  | "crit"
  | "nodata"
  | "paused"
  | "pending";

export interface StatusPillProps {
  status: StatusPillStatus;
  /** dot+label (default) or dot-only. */
  dotOnly?: boolean;
  /** Override label copy (defaults to the status name). */
  label?: string;
  className?: string;
}

const LABELS: Record<StatusPillStatus, string> = {
  ok: "up",
  warn: "degraded",
  crit: "down",
  nodata: "no data",
  paused: "paused",
  pending: "pending",
};

// Decided 2026-07-16: paused → nodata tint · pending → text-2.
const DOT: Record<StatusPillStatus, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  nodata: "bg-nodata",
  paused: "bg-nodata",
  pending: "bg-text-2",
};

const TEXT: Record<StatusPillStatus, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  nodata: "text-nodata",
  paused: "text-nodata",
  pending: "text-text-2",
};

/**
 * StatusPill — status semantics are sacred (§2). Breathing animation only
 * while crit (MI-8); disabled under prefers-reduced-motion (§5).
 */
export function StatusPill({ status, dotOnly = false, label, className }: StatusPillProps) {
  return (
    <span
      data-status={status}
      className={clsx(
        "font-ui inline-flex items-center gap-1.5 text-[12px] font-medium",
        TEXT[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "inline-block size-2 rounded-full",
          DOT[status],
          status === "crit" && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {!dotOnly && <span>{label ?? LABELS[status]}</span>}
      {dotOnly && <span className="sr-only">{label ?? LABELS[status]}</span>}
    </span>
  );
}
