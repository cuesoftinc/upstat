"use client";

import { clsx } from "clsx";
import { Flame } from "lucide-react";
import type { Slo } from "@/models";

export interface SLOCardProps {
  slo: Slo;
  className?: string;
}

/** "3d" style age for the exhausted caption. */
function ageOf(iso: string, now = Date.now()): string {
  const min = Math.max(Math.round((now - Date.parse(iso)) / 60_000), 0);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Per-state caption per the master (48:95): healthy keeps the budget
 *  formula; burning leads with the page-on-call escalation; exhausted
 *  reports when the budget hit zero. */
function stateCaption(slo: Slo): string {
  if (slo.state === "burning")
    return `burn rate ${slo.burn_rate.toFixed(1)}× — page on-call`;
  if (slo.state === "exhausted")
    return `budget exhausted${slo.exhausted_at ? ` ${ageOf(slo.exhausted_at)} ago` : ""}`;
  const budget = Math.max(0, Math.min(100, slo.budget_remaining_pct));
  return `error budget ${budget.toFixed(0)}% left · burn ${slo.burn_rate.toFixed(1)}×`;
}

/**
 * SLOCard — §8.2: healthy / burning (flame) / exhausted; error-budget bar
 * depletes right-to-left; burn animates on load (MI-15, reduced-motion safe).
 * Captions are per-state (master 48:95); the burning icon stays lucide
 * `flame` — §8.1 ratifies flame for burn-rate (the master's zap is the
 * design-side fix).
 */
export function SLOCard({ slo, className }: SLOCardProps) {
  const budget = Math.max(0, Math.min(100, slo.budget_remaining_pct));
  return (
    <div
      data-state={slo.state}
      className={clsx(
        // w-full capped at the Figma 256px card — shrinks with its grid cell
        // instead of overflowing narrow viewports (390/768 support)
        "font-ui flex w-full max-w-64 flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-text">
          {slo.name}
        </span>
        {slo.state === "burning" && (
          <Flame
            aria-label="burn rate above threshold"
            className="size-4 shrink-0 text-warn"
          />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        {/* Figma 48:95: Inter semibold 20, colored per state (ok/warn/crit) */}
        <span
          className={clsx(
            "text-[20px] font-semibold tabular-nums",
            slo.state === "healthy" && "text-ok-text",
            slo.state === "burning" && "text-warn-text",
            slo.state === "exhausted" && "text-crit",
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
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
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

      {/* per-state caption (master 48:95) */}
      <span className="text-[12px] tabular-nums text-text-2">
        {stateCaption(slo)}
      </span>
    </div>
  );
}
