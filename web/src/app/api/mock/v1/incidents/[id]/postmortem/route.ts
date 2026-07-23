import type { Postmortem, PostmortemInput } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";

/**
 * B9 postmortem template (pages.md B9 "postmortem doc template on
 * resolve"). GET reads the composed doc (404 until one exists); PUT
 * creates-or-updates it — resolved incidents only (`422
 * incident_not_resolved`). The mock freezes the incident timeline into the
 * doc server-side and stamps the incident's `postmortem_key`, mirroring
 * the data-model.md §5 Cloud Storage layout.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (!db.incidents.some((i) => i.id === id)) return notFound("incident");
  const doc = db.postmortems[id];
  return doc ? jsonOk(doc) : notFound("postmortem");
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const incident = db.incidents.find((i) => i.id === id);
  if (!incident) return notFound("incident");
  if (incident.status !== "resolved") {
    return jsonError(
      422,
      "incident_not_resolved",
      "postmortems attach to resolved incidents",
    );
  }
  const body = await readJson<Partial<PostmortemInput>>(req);
  if (
    !body ||
    typeof body.author !== "string" ||
    !body.author ||
    typeof body.impact !== "string" ||
    typeof body.root_cause !== "string" ||
    !Array.isArray(body.action_items) ||
    body.action_items.some((item) => typeof item !== "string")
  ) {
    return jsonError(
      422,
      "bad_shape",
      "author, impact, root_cause and action_items[] are required",
    );
  }

  const now = iso(Date.now());
  const existing = db.postmortems[id];
  const doc: Postmortem = {
    incident_id: id,
    title: `${incident.key} — ${incident.title}`,
    author: body.author,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    impact: body.impact,
    root_cause: body.root_cause,
    action_items: body.action_items.filter((item) => item.trim() !== ""),
    // auto-filled: the incident timeline frozen at composition time,
    // oldest-first (the composer previews exactly this)
    timeline: [...(db.timelines[id] ?? [])]
      .sort((a, b) => (a.ts < b.ts ? -1 : 1))
      .map((entry) => ({
        ts: entry.ts,
        phase: entry.phase,
        author: entry.author,
        body: entry.body,
      })),
  };
  db.postmortems[id] = doc;
  incident.postmortem_key = `upstat/postmortems/${db.org.id}/${id}.md`;
  return jsonOk(doc, existing ? 200 : 201);
}
