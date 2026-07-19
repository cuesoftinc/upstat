/**
 * Public status page read model (pages.md B7) — derived LIVE from the
 * owning org's monitors + incidents, so a declared incident reflects on
 * `/status/{slug}` immediately (pages.md B9 status-page linkage).
 */

import type { StatusPage, StatusPageIncident, StatusPageOverall } from "@/models";
import type { MockDb } from "./seed";
import { monitorHistory } from "./uptime-data";
import { iso } from "./util";

function overallFor(db: MockDb): StatusPageOverall {
  const anyDown = db.monitors.some((m) => m.status === "down" && !m.muted);
  const open = db.incidents.filter((i) => i.status !== "resolved");
  const active = open.filter((i) => i.status !== "monitoring");
  if (active.some((i) => i.sev === 1) || anyDown) return "major_outage";
  if (active.some((i) => i.sev === 2)) return "partial_outage";
  if (open.length > 0) return "degraded"; // monitoring — mitigated, watching
  return "operational";
}

export function buildStatusPage(db: MockDb, slug: string, now = Date.now()): StatusPage {
  // Public components = the active, unmuted checks (paused stays internal).
  const components = db.monitors
    .filter((m) => m.active && !m.muted)
    .map((m) => {
      const history = monitorHistory(m, now, db.outage);
      return {
        name: m.name,
        status: m.status,
        days: history.days,
        uptime_pct: history.uptime_90d_pct,
      };
    });

  const incidents: StatusPageIncident[] = [...db.incidents]
    .sort((a, b) => {
      const openA = a.status !== "resolved" ? 0 : 1;
      const openB = b.status !== "resolved" ? 0 : 1;
      if (openA !== openB) return openA - openB;
      return a.started_at < b.started_at ? 1 : -1;
    })
    .map((incident) => ({
      key: incident.key,
      title: incident.title,
      sev: incident.sev,
      status: incident.status,
      started_at: incident.started_at,
      updates: [...(db.timelines[incident.id] ?? [])]
        .sort((a, b) => (a.ts < b.ts ? 1 : -1))
        .map(({ ts, phase, body }) => ({ ts, phase, body })),
    }));

  return {
    slug,
    org_name: db.org.name,
    overall: overallFor(db),
    updated_at: iso(now),
    components,
    incidents,
  };
}
