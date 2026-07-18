"use client";

import { clsx } from "clsx";
import type { LogLevel } from "@/models";

export interface LevelChipProps {
  level: LogLevel;
  className?: string;
}

// Mapping [Decided 2026-07-16]: INFO → brand · DEBUG → text-2 · TRACE →
// nodata; ERROR/WARN keep crit/warn.
const TINT: Record<LogLevel, string> = {
  ERROR: "text-crit border-crit/40",
  WARN: "text-warn border-warn/40",
  INFO: "text-brand border-brand/40",
  DEBUG: "text-text-2 border-border",
  TRACE: "text-nodata border-border",
};

/** LevelChip — log level chip ×5, extracted from LogLine (§8.2). */
export function LevelChip({ level, className }: LevelChipProps) {
  return (
    <span
      data-level={level}
      className={clsx(
        "font-data inline-flex h-4.5 w-[52px] items-center justify-center rounded-(--radius)",
        "border text-[11px] font-medium tracking-wide",
        TINT[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
