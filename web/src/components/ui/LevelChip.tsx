"use client";

import { clsx } from "clsx";
import type { LogLevel } from "@/models";

export interface LevelChipProps {
  level: LogLevel;
  className?: string;
}

// Mapping [Decided 2026-07-16]: INFO → brand · DEBUG → text-2 · TRACE →
// nodata; ERROR/WARN keep crit/warn. 14% tint container (Figma 40:33).
const TINT: Record<LogLevel, string> = {
  ERROR: "text-crit-text bg-crit/14",
  WARN: "text-warn-text bg-warn/14",
  INFO: "text-brand-text bg-brand/14",
  DEBUG: "text-text-2-text bg-text-2/14",
  TRACE: "text-nodata-text bg-nodata/14",
};

/** LevelChip — log level chip ×5, extracted from LogLine (§8.2). */
export function LevelChip({ level, className }: LevelChipProps) {
  return (
    <span
      data-level={level}
      className={clsx(
        "font-data inline-flex items-center justify-center rounded-(--radius)",
        "px-1.5 py-0.5 text-[11px] font-medium",
        TINT[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
