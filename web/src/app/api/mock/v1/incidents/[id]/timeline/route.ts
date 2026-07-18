import type { IncidentPhase, TimelineEntry } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** GET /v1/incidents/{id}/timeline — newest-first entries (MI-10). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (!db.incidents.some((i) => i.id === id)) return notFound("incident");
  const entries = [...(db.timelines[id] ?? [])].sort((a, b) =>
    a.ts < b.ts ? 1 : -1,
  );
  return jsonOk(entries);
}

/** POST — timeline composer; `phase` mirrors the `/status` slash command. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const incident = db.incidents.find((i) => i.id === id);
  if (!incident) return notFound("incident");
  const body = await readJson<{ phase?: IncidentPhase; body?: string; author?: string }>(req);
  if (!body?.body || !body.author) {
    return jsonError(422, "bad_shape", "body and author are required");
  }
  const entry: TimelineEntry = {
    id: nextId("tl"),
    incident_id: id,
    ts: iso(Date.now()),
    author: body.author,
    phase: body.phase ?? incident.status,
    body: body.body,
  };
  db.timelines[id] = [...(db.timelines[id] ?? []), entry];
  if (body.phase && body.phase !== incident.status) {
    incident.status = body.phase;
    incident.resolved_at = body.phase === "resolved" ? entry.ts : null;
  }
  return jsonOk(entry, 201);
}
