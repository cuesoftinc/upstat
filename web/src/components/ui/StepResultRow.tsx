"use client";

import { clsx } from "clsx";
import type { SyntheticStepKind } from "@/models";
import { StatusPill } from "./StatusPill";

export interface StepResultRowProps {
  /** 1-based step index. */
  index: number;
  kind: SyntheticStepKind;
  summary: string;
  result: "pass" | "fail";
  durationMs: number;
  /** Bar width ∝ duration — fraction of the run's longest step (0..1]. */
  durationFraction: number;
  className?: string;
}

/**
 * StepResultRow — design.md §8.2b: result pass/fail · step index ·
 * StatusPill ("PASS" ok / "FAIL" crit) · summary · duration bar (brand
 * fill, crit on fail; width ∝ duration) · fixed-precision ms; the B7
 * run-view timeline row (Figma "B7 — Synthetic check run").
 */
export function StepResultRow({
  index,
  kind,
  summary,
  result,
  durationMs,
  durationFraction,
  className,
}: StepResultRowProps) {
  const pct = Math.round(Math.min(Math.max(durationFraction, 0.04), 1) * 100);
  return (
    <div
      data-result={result}
      className={clsx(
        "font-ui flex h-11 items-center gap-3 border-b border-border px-3",
        className,
      )}
    >
      <span className="font-data w-4 text-center text-[12px] tabular-nums text-text-2">
        {index}
      </span>
      <StatusPill
        status={result === "pass" ? "ok" : "crit"}
        label={result === "pass" ? "PASS" : "FAIL"}
      />
      <span className="font-data min-w-0 flex-1 truncate text-[13px] text-text">
        {kind === "assertion" ? `assert ${summary}` : summary}
      </span>
      <span
        aria-hidden="true"
        className="hidden h-1 w-40 shrink-0 overflow-hidden rounded-full bg-border sm:block"
      >
        <span
          className={clsx(
            "block h-full rounded-full",
            result === "pass" ? "bg-brand" : "bg-crit",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-data w-16 shrink-0 text-right text-[12px] tabular-nums text-text-2">
        {durationMs.toLocaleString("en-US")} ms
      </span>
    </div>
  );
}
