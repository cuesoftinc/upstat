/**
 * Public status page — pages.md B7: `status.upstat.cuesoft.io/{slug}` →
 * `/status/{slug}`, unauthenticated, deliberately outside `/dashboard`.
 * The read model behind the `GetStatusPage` data shape over HTTP.
 */

import type { IncidentPhase, IncidentSev } from "./incidents";
import type { MonitorStatus, UptimeDay } from "./monitors";

export type StatusPageOverall =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";

export interface StatusPageComponent {
  name: string;
  status: MonitorStatus;
  /** 90-day strip (UptimeCard technique). */
  days: UptimeDay[];
  uptime_pct: number | null;
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
