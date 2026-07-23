import type { SavedView } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";
import { nextId } from "@/mocks/util";

/** GET /v1/views — saved views, optionally scoped to a surface (MI-18). */
export async function GET(req: Request) {
  const surface = new URL(req.url).searchParams.get("surface");
  const views = getDb().views;
  return jsonOk(surface ? views.filter((v) => v.surface === surface) : views);
}

/** POST /v1/views — save the current filter set as a named chip (MI-18). */
export async function POST(req: Request) {
  const body =
    await readJson<Pick<SavedView, "name" | "scope" | "surface" | "query">>(
      req,
    );
  if (!body?.name || !body.surface || !body.query) {
    return jsonError(422, "bad_shape", "name, surface and query are required");
  }
  const db = getDb();
  if (
    db.views.some((v) => v.surface === body.surface && v.name === body.name)
  ) {
    return jsonError(
      409,
      "name_taken",
      "a view with this name exists on this surface",
    );
  }
  const view: SavedView = {
    id: nextId("view"),
    name: body.name,
    scope: body.scope ?? "personal",
    surface: body.surface,
    query: body.query,
    ...(body.scope === "org" ? { shared_with: ["Ibukun"] } : {}),
    created_at: iso(Date.now()),
  };
  db.views.push(view);
  return jsonOk(view, 201);
}
