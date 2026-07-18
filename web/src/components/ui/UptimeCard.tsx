"use client";

import { clsx } from "clsx";
import type { UptimeDay } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";
import { Tooltip } from "./Tooltip";

export interface UptimeCardProps {
  name: string;
  /** 90 entries, oldest → newest (§8.2: all-up / with-outage-bars / nodata-gaps). */
  days: UptimeDay[];
  /** 90-day uptime %, null when nodata. */
  uptimePct: number | null;
  /** p95 response time (ms) for the footer meta (Figma 49:164). */
  p95Ms?: number;
  /** Header status pill; derived from the latest day when omitted. */
  status?: StatusPillStatus;
  className?: string;
}

function barTint(day: UptimeDay): string {
  if (day.uptime_pct === null) return "bg-nodata/50";
  if (day.uptime_pct >= 99.9) return "bg-ok";
  if (day.uptime_pct >= 98) return "bg-warn";
  return "bg-crit";
}

function deriveStatus(days: UptimeDay[]): StatusPillStatus {
  const latest = days[days.length - 1];
  if (!latest || latest.uptime_pct === null) return "nodata";
  if (latest.uptime_pct >= 99.9) return "ok";
  if (latest.uptime_pct >= 98) return "warn";
  return "crit";
}

/**
 * UptimeCard — the classic 90-day status strip (§3/§8.2, Figma 49:370):
 * name + dot-only StatusPill header, 3×24 bars, mono uptime/p95 footer.
 * Bars fill on first render with a 400ms stagger (MI-8); per-day tooltip.
 */
export function UptimeCard({ name, days, uptimePct, p95Ms, status, className }: UptimeCardProps) {
  return (
    <div
      className={clsx(
        "font-ui flex w-full max-w-xl flex-col gap-2.5 rounded-(--radius) border border-border bg-bg-elev p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-text">{name}</span>
        <StatusPill status={status ?? deriveStatus(days)} dotOnly />
      </div>

      <div className="flex items-stretch gap-px" role="img" aria-label={`${name} 90-day uptime`}>
        {days.map((day, i) => (
          <Tooltip
            key={day.date}
            content={[
              { label: day.date, value: day.uptime_pct === null ? "no data" : `${day.uptime_pct}%` },
              ...(day.down_minutes > 0
                ? [{ label: "downtime", value: `${day.down_minutes}m` }]
                : []),
            ]}
          >
            <span
              data-date={day.date}
              style={{ animationDelay: `${(i / days.length) * 400}ms` }}
              className={clsx(
                "block h-6 w-[3px] origin-bottom rounded-[1px]",
                barTint(day),
                "animate-[bar-fill_var(--duration-entrance)_var(--ease-standard)_both] motion-reduce:animate-none",
              )}
            />
          </Tooltip>
        ))}
      </div>

      <div className="font-data flex items-center justify-between gap-2 text-[12px] tabular-nums">
        <span className="text-text">
          {uptimePct === null ? "— uptime" : `${uptimePct.toFixed(3)}% uptime`} · {days.length} days
        </span>
        {p95Ms !== undefined && <span className="text-text-2">p95 {p95Ms} ms</span>}
      </div>
    </div>
  );
}
