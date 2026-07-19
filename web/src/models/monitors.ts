/** Monitors / uptime checks — data-model.md §1 (current entities, B7 pillar). */

export type MonitorStatus = "up" | "down" | "pending" | "nodata" | "paused";

export type MonitorType = "website" | "server" | "api" | "blog";

export interface Monitor {
  id: string;
  name: string;
  target: string;
  type: MonitorType;
  active: boolean;
  status: MonitorStatus;
  muted: boolean;
  interval_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
  consecutive_failures: number;
  last_checked_at: string | null;
  last_response_time_ms: number | null;
  last_status_code: number | null;
  created_at: string;
  updated_at: string;
}

export interface CheckResult {
  id: string;
  monitor_id: string;
  up: boolean;
  status_code: number;
  response_time_ms: number;
  checked_at: string;
}

/** Per-day rollup for the 90-day uptime strip (UptimeCard). */
export interface UptimeDay {
  date: string;
  /** null = nodata gap. */
  uptime_pct: number | null;
  down_minutes: number;
}

export interface MonitorHistory {
  monitor_id: string;
  days: UptimeDay[];
  /** Recent raw checks for the response-time chart. */
  recent_checks: CheckResult[];
  uptime_90d_pct: number | null;
}
