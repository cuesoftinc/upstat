"use client";

import { clsx } from "clsx";
import { Activity, BarChart2, Globe, ScrollText, Zap } from "lucide-react";
import type { AlertRule, AlertSignal } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";

export interface AlertRuleCardProps {
  rule: AlertRule;
  onClick?: () => void;
  className?: string;
}

// Signal icon (Figma 69:564 leads each card with the signal's icon;
// metric-threshold = icon/bar-chart).
const SIGNAL_ICON: Record<AlertSignal, typeof BarChart2> = {
  uptime: Globe,
  metric: BarChart2,
  log: ScrollText,
  trace: Activity,
  slo_burn: Zap,
};

const STATE_TO_PILL: Record<AlertRule["state"], StatusPillStatus> = {
  ok: "ok",
  warn: "warn",
  alert: "crit",
  nodata: "nodata",
};

/**
 * AlertRuleCard — §8.2 (Figma 69:564): signal icon + name + StatusPill,
 * mono query summary, mono threshold line
 * (`warn > 800 · crit > 1500 · for 5m`).
 */
export function AlertRuleCard({
  rule,
  onClick,
  className,
}: AlertRuleCardProps) {
  const Icon = SIGNAL_ICON[rule.signal];
  return (
    <button
      type="button"
      onClick={onClick}
      data-signal={rule.signal}
      className={clsx(
        "font-ui flex w-full flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3.5 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:border-text-2",
        className,
      )}
    >
      <div className="flex w-full items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-text-2" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
          {rule.name}
        </span>
        <StatusPill status={STATE_TO_PILL[rule.state]} />
      </div>
      <code className="font-data w-full truncate text-[12px] text-text-2">
        {rule.query_string}
      </code>
      <div className="font-data flex w-full items-center gap-2 text-[12px] tabular-nums text-text">
        <span className="truncate">
          {rule.thresholds.warn !== null && (
            <>warn &gt; {rule.thresholds.warn} · </>
          )}
          crit &gt; {rule.thresholds.crit} · for {rule.thresholds.window}
        </span>
        {rule.last_triggered_at && (
          <span className="ml-auto shrink-0 text-[11px] text-text-2">
            last triggered{" "}
            {rule.last_triggered_at.slice(0, 16).replace("T", " ")}
          </span>
        )}
      </div>
    </button>
  );
}
