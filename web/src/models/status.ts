/**
 * Public status page — pages.md B7: `status.upstat.cuesoft.io/{slug}` →
 * `/status/{slug}`, unauthenticated, deliberately outside `/dashboard`.
 * The read model behind the `GetStatusPage` data shape over HTTP.
 */

import type { IncidentPhase, IncidentSev } from "./incidents";
import type { MonitorStatus, UptimeDay } from "./monitors";

export type StatusPageOverall =
  "operational" | "degraded" | "partial_outage" | "major_outage";

export interface StatusPageComponent {
  name: string;
  status: MonitorStatus;
  /** 90-day strip (UptimeCard technique). */
  days: UptimeDay[];
  uptime_pct: number | null;
  /** Latency figure from the owning check — the SAME source the uptime
   *  pillar shows, so list/detail/status page agree (QA 2026-07-19). */
  p95_ms: number | null;
}

export interface StatusPageIncident {
  key: string;
  title: string;
  sev: IncidentSev;
  status: IncidentPhase;
  started_at: string;
  updates: { ts: string; phase: IncidentPhase; body: string }[];
}

export interface StatusPage {
  slug: string;
  org_name: string;
  overall: StatusPageOverall;
  updated_at: string;
  components: StatusPageComponent[];
  /** Open incident first (when any), then resolved history, newest-first. */
  incidents: StatusPageIncident[];
}

/* ------------------------------------------------------------------ */
/* Builder (pages.md B7 [Designed 2026-07-20] — settings surface)       */
/* ------------------------------------------------------------------ */

/** One builder row — row order IS the public page order (design.md §8.2b). */
export interface StatusPageComponentConfig {
  id: string;
  /** Public display name (inline rename). */
  name: string;
  /** Mapped uptime check (monitor-mapping Select); null = unmapped. */
  monitor_id: string | null;
}

/**
 * The status-page builder document: branding (page name · slug) + the
 * ordered component list. The public page it produces is the existing
 * `/status/{slug}` construction.
 */
export interface StatusPageConfig {
  /** Shown in the public page header. */
  name: string;
  /** Public at /status/{slug} — owner-chosen, unique (pages.md B7). */
  slug: string;
  components: StatusPageComponentConfig[];
}
