import type { Dashboard } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";

function find(id: string): Dashboard | undefined {
  return getDb().dashboards.find((d) => d.id === id);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dashboard = find(id);
  return dashboard ? jsonOk(dashboard) : notFound("dashboard");
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dashboard = find(id);
  if (!dashboard) return notFound("dashboard");
  const body = await readJson<Partial<Dashboard>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const { name, favorite, shared, template_vars } = body;
  if (name !== undefined) dashboard.name = name;
  if (favorite !== undefined) dashboard.favorite = favorite;
  if (shared !== undefined) dashboard.shared = shared;
  if (template_vars !== undefined) dashboard.template_vars = template_vars;
  dashboard.updated_at = iso(Date.now());
  return jsonOk(dashboard);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.dashboards.findIndex((d) => d.id === id);
  if (idx === -1) return notFound("dashboard");
  db.dashboards.splice(idx, 1);
  return new Response(null, { status: 204 });
}
