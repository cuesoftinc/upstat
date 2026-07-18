import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** GET /v1/dashboards — list (org-shared + favorites, pages.md B2). */
export async function GET() {
  return jsonOk(getDb().dashboards);
}

/** POST /v1/dashboards — create-dashboard flow (name → widget picker). */
export async function POST(req: Request) {
  const body = await readJson<{ name?: string }>(req);
  if (!body?.name) return jsonError(422, "bad_shape", "name is required");
  const db = getDb();
  if (db.dashboards.some((d) => d.name === body.name)) {
    return jsonError(409, "name_taken", "a dashboard with this name exists");
  }
  const dashboard = {
    id: nextId("dash"),
    org_id: db.org.id,
    name: body.name,
    favorite: false,
    shared: false,
    template_vars: {},
    widgets: [],
    updated_at: iso(Date.now()),
  };
  db.dashboards.push(dashboard);
  return jsonOk(dashboard, 201);
}
