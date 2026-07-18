"use client";

import { clsx } from "clsx";
import type { AlertRule, AlertSignal } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";

export interface AlertRuleCardProps {
  rule: AlertRule;
  onClick?: () => void;
  className?: string;
}

const SIGNAL_LABEL: Record<AlertSignal, string> = {
  uptime: "uptime",
  metric: "metric threshold",
  log: "log pattern",
  trace: "trace latency",
  slo_burn: "SLO burn",
};

const STATE_TO_PILL: Record<AlertRule["state"], StatusPillStatus> = {
  ok: "ok",
  warn: "warn",
  alert: "crit",
  nodata: "nodata",
};

/**
 * AlertRuleCard — §8.2: type metric-threshold / log-pattern / trace-latency
 * / slo-burn · mono query summary + threshold line.
 */
export function AlertRuleCard({ rule, onClick, className }: AlertRuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-signal={rule.signal}
      className={clsx(
        "font-ui flex w-full flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:border-text-2",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <StatusPill status={STATE_TO_PILL[rule.state]} dotOnly />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{rule.name}</span>
        <span className="shrink-0 rounded-(--radius) border border-border px-1.5 text-[10px] uppercase tracking-wide text-text-2">
          {SIGNAL_LABEL[rule.signal]}
        </span>
      </div>
      <code className="font-data truncate rounded-(--radius) bg-bg px-2 py-1 text-[12px] text-text-2">
        {rule.query_string}
      </code>
      <div className="flex items-center gap-3 text-[11px] tabular-nums text-text-2">
        {rule.thresholds.warn !== null && (
          <span>
            warn <span className="text-warn">{rule.thresholds.warn}</span>
          </span>
        )}
        <span>
          crit <span className="text-crit">{rule.thresholds.crit}</span>
        </span>
        <span>window {rule.thresholds.window}</span>
        {rule.last_triggered_at && (
          <span className="ml-auto">last triggered {rule.last_triggered_at.slice(0, 16).replace("T", " ")}</span>
        )}
      </div>
    </button>
  );
}
