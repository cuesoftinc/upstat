"use client";

import { clsx } from "clsx";

/** §8.2: ok / warn / crit (breathing) / nodata / paused / pending. */
export type StatusPillStatus =
  "ok" | "warn" | "crit" | "nodata" | "paused" | "pending";

export interface StatusPillProps {
  status: StatusPillStatus;
  /** dot+label (default) or dot-only. */
  dotOnly?: boolean;
  /** Override label copy (defaults to the status name). */
  label?: string;
  className?: string;
}

// Figma 39:51 — labels are the uppercase status names.
const LABELS: Record<StatusPillStatus, string> = {
  ok: "OK",
  warn: "WARN",
  crit: "CRIT",
  nodata: "NO DATA",
  paused: "PAUSED",
  pending: "PENDING",
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

// 14% tint container in the status color (Figma tint-bg).
const TINT: Record<StatusPillStatus, string> = {
  ok: "bg-ok/14",
  warn: "bg-warn/14",
  crit: "bg-crit/14",
  nodata: "bg-nodata/14",
  paused: "bg-nodata/14",
  pending: "bg-text-2/14",
};

/**
 * StatusPill — status semantics are sacred (§2). 14% tint container +
 * status-colored dot/label (Figma 39:51). Breathing animation only while
 * crit (MI-8: dot scale 1→1.25→1, ~1.6s); disabled under
 * prefers-reduced-motion (§5).
 */
export function StatusPill({
  status,
  dotOnly = false,
  label,
  className,
}: StatusPillProps) {
  return (
    <span
      data-status={status}
      className={clsx(
        "font-ui inline-flex items-center gap-1.5 rounded-(--radius) text-[12px] font-medium",
        // 4px-grid padding (adjudicated restyle 2026-07-19; was 5px/3px)
        dotOnly ? "p-1" : "px-2 py-1",
        TINT[status],
        TEXT[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "inline-block size-2 rounded-full",
          DOT[status],
          status === "crit" &&
            "animate-[breathe_1.6s_var(--ease-standard)_infinite] motion-reduce:animate-none",
        )}
      />
      {!dotOnly && <span>{label ?? LABELS[status]}</span>}
      {dotOnly && <span className="sr-only">{label ?? LABELS[status]}</span>}
    </span>
  );
}
