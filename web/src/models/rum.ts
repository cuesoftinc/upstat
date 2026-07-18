/** RUM / website analytics — pages.md B6 atop the events layer (data-model.md §2). */

export type DeviceClass = "mobile" | "desktop" | "tablet";

/** Closed dims vocabulary (api.md §3.1 — the schema is the privacy boundary). */
export interface RumEventDims {
  path?: string;
  referrer_host?: string;
  device_class?: DeviceClass;
  country?: string;
}

export interface RumEvent {
  name: string;
  ts: string;
  dims: RumEventDims;
}

/** Aggregate summary for the RUM overview (analytics-math.md §2/§4 honesty rules). */
export interface RumSummary {
  page_views: number;
  visits: number;
  /** Undefined (null) when visits = 0 — analytics-math.md §2. */
  bounce_rate: number | null;
  /** "Engaged visits" average — bounces excluded. */
  avg_visit_seconds: number | null;
  /** Multi-day ranges show daily-average uniques, never a summed total (§4). */
  uniques_daily_avg: number;
  /** Machine-visible non-additivity contract (analytics-math.md §4). */
  uniques_additive: false;
  series: { bucket: string; count: number; uniques: number }[];
  top_pages: { value: string; count: number }[];
  top_referrers: { value: string; count: number }[];
  devices: { value: DeviceClass; count: number }[];
  countries: { value: string; count: number }[];
}

/** Core web vitals (LCP/CLS/INP from the browser SDK — pages.md B6). */
export interface RumVitals {
  lcp_ms: { p50: number; p75: number; p95: number };
  cls: { p50: number; p75: number; p95: number };
  inp_ms: { p50: number; p75: number; p95: number };
  /** Per-bucket p75 series for vitals charts. */
  series: { bucket: string; lcp_ms: number; cls: number; inp_ms: number }[];
}

export type ErrorGroupState = "new" | "ongoing" | "regressed";

/** JS errors grouped by fingerprint (pages.md B6; ErrorGroupRow contract). */
export interface ErrorGroup {
  fingerprint: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  state: ErrorGroupState;
  sparkline: number[];
}
