"use client";

import { clsx } from "clsx";
import { Flame } from "lucide-react";
import type { Slo } from "@/models";

export interface SLOCardProps {
  slo: Slo;
  className?: string;
}

/**
 * SLOCard — §8.2: healthy / burning (flame) / exhausted; error-budget bar
 * depletes right-to-left; burn animates on load (MI-15, reduced-motion safe).
 */
export function SLOCard({ slo, className }: SLOCardProps) {
  const budget = Math.max(0, Math.min(100, slo.budget_remaining_pct));
  return (
    <div
      data-state={slo.state}
      className={clsx(
        "font-ui flex w-64 flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-text">{slo.name}</span>
        {slo.state === "burning" && (
          <Flame aria-label="burn rate above threshold" className="size-4 shrink-0 text-warn" />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "font-data text-[20px] font-semibold tabular-nums",
            slo.state === "exhausted" ? "text-crit" : "text-text",
          )}
        >
          {slo.current.toFixed(2)}%
        </span>
        <span className="text-[12px] tabular-nums text-text-2">
          target {slo.target}% · {slo.window}
        </span>
      </div>

      {/* budget bar — depletes right-to-left */}
      <div
        role="meter"
        aria-label="Error budget remaining"
        aria-valuenow={budget}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-bg"
      >
        <div
          style={{ width: `${budget}%` }}
          className={clsx(
            "h-full rounded-full transition-[width] duration-[var(--duration-entrance)] ease-standard motion-reduce:transition-none",
            slo.state === "healthy" && "bg-ok",
            slo.state === "burning" && "bg-warn",
            slo.state === "exhausted" && "bg-crit",
          )}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] tabular-nums text-text-2">
        <span>{budget.toFixed(0)}% budget left</span>
        <span>burn ×{slo.burn_rate.toFixed(1)}</span>
      </div>
    </div>
  );
}
