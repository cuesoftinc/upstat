import type { Incident, IncidentSev } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** GET /v1/incidents — list (pages.md B9). */
export async function GET() {
  return jsonOk(getDb().incidents);
}

/** POST /v1/incidents — declare (modal: sev, title, commander). */
export async function POST(req: Request) {
  const body = await readJson<{ title?: string; sev?: number; commander?: string }>(req);
  if (!body?.title || !body.sev || !body.commander) {
    return jsonError(422, "bad_shape", "title, sev and commander are required");
  }
  if (body.sev < 1 || body.sev > 4) {
    return jsonError(422, "bad_shape", "sev must be 1..4");
  }
  const db = getDb();
  const nextNumber =
    1 +
    db.incidents.reduce((max, i) => {
      const n = Number(i.key.replace("INC-", ""));
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
  const incident: Incident = {
    id: nextId("inc"),
    org_id: db.org.id,
    key: `INC-${nextNumber}`,
    title: body.title,
    sev: body.sev as IncidentSev,
    status: "investigating",
    roles: { commander: body.commander, responders: [] },
    started_at: iso(Date.now()),
    resolved_at: null,
    postmortem_key: null,
    services: [],
  };
  db.incidents.unshift(incident);
  db.timelines[incident.id] = [
    {
      id: nextId("tl"),
      incident_id: incident.id,
      ts: incident.started_at,
      author: body.commander,
      phase: "investigating",
      body: `Declared SEV-${incident.sev}: ${incident.title}`,
    },
  ];
  return jsonOk(incident, 201);
}
