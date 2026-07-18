"use client";

import { clsx } from "clsx";
import type { UptimeDay } from "@/models";
import { Tooltip } from "./Tooltip";

export interface UptimeCardProps {
  name: string;
  /** 90 entries, oldest → newest (§8.2: all-up / with-outage-bars / nodata-gaps). */
  days: UptimeDay[];
  /** 90-day uptime %, null when nodata. */
  uptimePct: number | null;
  /** Latency sparkline values (recent response times, ms). */
  sparkline?: number[];
  className?: string;
}

function barTint(day: UptimeDay): string {
  if (day.uptime_pct === null) return "bg-nodata/50";
  if (day.uptime_pct >= 99.9) return "bg-ok";
  if (day.uptime_pct >= 98) return "bg-warn";
  return "bg-crit";
}

/**
 * UptimeCard — the classic 90-day status strip (§3/§8.2). Bars fill on first
 * render with a 400ms stagger (MI-8); per-day tooltip detail.
 */
export function UptimeCard({ name, days, uptimePct, sparkline, className }: UptimeCardProps) {
  return (
    <div
      className={clsx(
        "font-ui flex w-full max-w-xl flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-text">{name}</span>
        <span className="font-data text-[13px] font-semibold tabular-nums text-text">
          {uptimePct === null ? "—" : `${uptimePct.toFixed(3)}%`}
        </span>
      </div>

      <div className="flex h-8 items-stretch gap-px" role="img" aria-label={`${name} 90-day uptime`}>
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
                "block h-8 w-1 origin-bottom rounded-[1px]",
                barTint(day),
                "animate-[bar-fill_var(--duration-entrance)_var(--ease-standard)_both] motion-reduce:animate-none",
              )}
            />
          </Tooltip>
        ))}
      </div>

      {sparkline && sparkline.length > 1 && (
        <svg
          viewBox={`0 0 ${sparkline.length - 1} 24`}
          preserveAspectRatio="none"
          aria-label="latency sparkline"
          className="h-6 w-full"
          style={{ width: "100%", height: 24 }}
        >
          <polyline
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            points={sparklinePoints(sparkline)}
          />
        </svg>
      )}
    </div>
  );
}

function sparklinePoints(values: number[]): string {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  return values
    .map((v, i) => `${i},${24 - ((v - min) / range) * 20 - 2}`)
    .join(" ");
}
