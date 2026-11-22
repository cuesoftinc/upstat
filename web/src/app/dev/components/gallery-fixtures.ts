import type { LogEvent, UptimeDay } from "@/models";
import { type StatusPillStatus } from "@/components/ui/StatusPill";

export const STATUSES: StatusPillStatus[] = [
  "ok",
  "warn",
  "crit",
  "nodata",
  "paused",
  "pending",
];

export const DAYS_90: UptimeDay[] = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 3, 20 + i)).toISOString().slice(0, 10),
  // an outage window around day 61 and nodata gaps early on
  uptime_pct: i === 61 ? 92.4 : i === 62 ? 98.1 : i < 4 ? null : 100,
  down_minutes: i === 61 ? 109 : i === 62 ? 27 : 0,
}));

export const LOG_EVENT: LogEvent = {
  id: "log_1",
  ts: "2026-07-18T09:12:44.120Z",
  service: "clickhouse",
  level: "ERROR",
  host: "gcp-lagos-1",
  message: "insert failed table=metrics_points code=252 too many parts",
  attrs: { env: "prod", table: "metrics_points", code: 252, retriable: true },
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
};
