"use client";

import { clsx } from "clsx";
import type { UptimeDay } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";
import { Tooltip } from "./Tooltip";

export interface StatusPageComponentRowProps {
  name: string;
  status: StatusPillStatus;
  /** 90-day strip (UptimeCard technique, §8.2). */
  days: UptimeDay[];
  uptimePct: number | null;
  className?: string;
}

function barTint(day: UptimeDay): string {
  if (day.uptime_pct === null) return "bg-nodata/50";
  if (day.uptime_pct >= 99.9) return "bg-ok";
  if (day.uptime_pct >= 98) return "bg-warn";
  return "bg-crit";
}

/** StatusPageComponentRow — name + StatusPill + 90-day bars + uptime % (B7). */
export function StatusPageComponentRow({
  name,
  status,
  days,
  uptimePct,
  className,
}: StatusPageComponentRowProps) {
  return (
    <div className={clsx("font-ui flex flex-col gap-1.5 border-b border-border py-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text">{name}</span>
        <StatusPill status={status} />
      </div>
      {/* overflow-x-auto: 90 fixed-width bars scroll on narrow viewports */}
      <div className="flex h-6 items-stretch gap-px overflow-x-auto" role="img" aria-label={`${name} 90-day uptime`}>
        {days.map((day) => (
          <Tooltip
            key={day.date}
            content={[
              { label: day.date, value: day.uptime_pct === null ? "no data" : `${day.uptime_pct}%` },
            ]}
          >
            <span className={clsx("block h-6 w-1 rounded-[1px]", barTint(day))} />
          </Tooltip>
        ))}
      </div>
      <span className="font-data text-[11px] tabular-nums text-text-2">
        {uptimePct === null ? "no data" : `${uptimePct.toFixed(3)}% over 90 days`}
      </span>
    </div>
  );
}
