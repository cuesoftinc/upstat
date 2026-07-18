import type { ServiceCatalogEntry } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entry = getDb().catalog.find((s) => s.id === id);
  if (!entry) return notFound("service");
  const body = await readJson<Partial<ServiceCatalogEntry>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const { name, owner, links, environments, telemetry } = body;
  if (name !== undefined) entry.name = name;
  if (owner !== undefined) entry.owner = owner;
  if (links !== undefined) entry.links = links;
  if (environments !== undefined) entry.environments = environments;
  if (telemetry !== undefined) entry.telemetry = telemetry;
  return jsonOk(entry);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.catalog.findIndex((s) => s.id === id);
  if (idx === -1) return notFound("service");
  db.catalog.splice(idx, 1);
  return new Response(null, { status: 204 });
}
