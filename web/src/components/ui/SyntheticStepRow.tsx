"use client";

import { clsx } from "clsx";
import { GripVertical, Trash2 } from "lucide-react";
import type { SyntheticStepKind } from "@/models";

export interface SyntheticStepRowProps {
  /** 1-based position — row order is execution order. */
  index: number;
  kind: SyntheticStepKind;
  /** Mono summary: `GET https://…` / `status == 200` / `wait 500 ms`. */
  summary: string;
  onDelete?: () => void;
  /** Keyboard reorder — ArrowUp/ArrowDown on the focused grip. */
  onMove?: (delta: -1 | 1) => void;
  className?: string;
}

// Kind chip copy (Mono/Micro 10) — Figma "B7 — Synthetic check builder".
const KIND_LABEL: Record<SyntheticStepKind, string> = {
  http: "HTTP",
  assertion: "ASSERT",
  wait: "WAIT",
};

/**
 * SyntheticStepRow — design.md §8.2b: kind http/assertion/wait · drag grip
 * + step index + kind chip + mono summary + delete; the B7 multi-step
 * check builder row (add via the quiet "Add step" button).
 */
export function SyntheticStepRow({
  index,
  kind,
  summary,
  onDelete,
  onMove,
  className,
}: SyntheticStepRowProps) {
  return (
    <div
      data-kind={kind}
      className={clsx(
        "font-ui flex h-11 items-center gap-3 rounded-(--radius) border border-border bg-bg-elev px-3",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Reorder step ${index}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onMove?.(-1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onMove?.(1);
          }
        }}
        className="cursor-grab text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
      <span className="font-data w-4 text-center text-[12px] tabular-nums text-text-2">
        {index}
      </span>
      <span className="font-data rounded-(--radius) border border-border px-1.5 py-0.5 text-[10px] tracking-wide text-text-2">
        {KIND_LABEL[kind]}
      </span>
      <span className="font-data min-w-0 flex-1 truncate text-[13px] text-text">
        {summary}
      </span>
      <button
        type="button"
        aria-label={`Delete step ${index}`}
        onClick={onDelete}
        className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-crit"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
