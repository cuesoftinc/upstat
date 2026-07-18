import type { Incident } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/mocks/util";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incident = getDb().incidents.find((i) => i.id === id);
  return incident ? jsonOk(incident) : notFound("incident");
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incident = getDb().incidents.find((i) => i.id === id);
  if (!incident) return notFound("incident");
  const body = await readJson<Partial<Incident>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const { title, sev, status, roles, services, postmortem_key } = body;
  if (title !== undefined) incident.title = title;
  if (sev !== undefined) incident.sev = sev;
  if (roles !== undefined) incident.roles = roles;
  if (services !== undefined) incident.services = services;
  if (postmortem_key !== undefined) incident.postmortem_key = postmortem_key;
  if (status !== undefined) {
    incident.status = status;
    incident.resolved_at = status === "resolved" ? iso(Date.now()) : null;
  }
  return jsonOk(incident);
}
