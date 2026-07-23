/** 90-day uptime strips + recent checks — the design.md §8.3 data pattern. */

import type { CheckResult, MonitorHistory, UptimeDay } from "@/models";
import type { Monitor } from "@/models";
import { DAY, MINUTE, iso } from "@/lib/format";
import { hashSeed, mulberry32 } from "@/lib/random";
import type { OutageWindow } from "./series";

export function monitorHistory(
  monitor: Monitor,
  now: number,
  outage: OutageWindow,
): MonitorHistory {
  const days: UptimeDay[] = [];
  const paused = monitor.status === "paused";
  const pending = monitor.status === "pending";
  const isCheckout = monitor.id === "mon_checkout";
  const isHomepage = monitor.id === "mon_homepage";

  for (let i = 89; i >= 0; i--) {
    const dayStart = now - i * DAY;
    const date = iso(dayStart).slice(0, 10);
    const r = mulberry32(hashSeed(`uptime:${monitor.id}:${date}`));

    if (pending) {
      days.push({ date, uptime_pct: null, down_minutes: 0 });
      continue;
    }
    // paused monitor: nodata gaps for the paused window (last 21 days)
    if (paused && i < 21) {
      days.push({ date, uptime_pct: null, down_minutes: 0 });
      continue;
    }
    // INC-42 dent on checkout (today)
    if (isCheckout && i === 0) {
      const downMin = Math.round((outage.end - outage.start) / MINUTE);
      days.push({
        date,
        uptime_pct: Math.round((1 - downMin / (24 * 60)) * 10000) / 100,
        down_minutes: downMin,
      });
      continue;
    }
    // INC-41 dent on homepage (23 days ago)
    if (isHomepage && i === 23) {
      days.push({ date, uptime_pct: 98.47, down_minutes: 22 });
      continue;
    }
    // occasional sub-100 blips elsewhere
    const blip = r() < 0.04 ? Math.round(r() * 9) + 1 : 0;
    days.push({
      date,
      uptime_pct: Math.round((1 - blip / (24 * 60)) * 10000) / 100,
      down_minutes: blip,
    });
  }

  const recentChecks: CheckResult[] = [];
  if (!paused && !pending) {
    const interval = Math.max(monitor.interval_seconds * 1000, 30_000);
    for (let i = 0; i < 120; i++) {
      const t = now - i * interval;
      const r = mulberry32(hashSeed(`check:${monitor.id}:${i}`));
      const inOutage = isCheckout && t >= outage.start && t <= outage.end;
      const up = inOutage ? r() < 0.2 : true;
      recentChecks.push({
        id: `chk_${monitor.id}_${i}`,
        monitor_id: monitor.id,
        up,
        status_code: up ? 200 : 503,
        response_time_ms: Math.round(
          (up ? 80 + r() * 220 : 2000 + r() * 3000) *
            (inOutage && up ? 2.4 : 1),
        ),
        checked_at: iso(t),
      });
    }
  }

  const known = days.filter((d) => d.uptime_pct !== null) as (UptimeDay & {
    uptime_pct: number;
  })[];
  const uptime90 =
    known.length === 0
      ? null
      : Math.round(
          (known.reduce((s, d) => s + d.uptime_pct, 0) / known.length) * 1000,
        ) / 1000;

  return {
    monitor_id: monitor.id,
    days,
    recent_checks: recentChecks,
    uptime_90d_pct: uptime90,
  };
}
