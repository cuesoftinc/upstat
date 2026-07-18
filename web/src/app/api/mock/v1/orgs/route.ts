import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** POST /v1/orgs — create-org onboarding step (pages.md B1; X-10 tz). */
export async function POST(req: Request) {
  const body = await readJson<{ name?: string; timezone?: string }>(req);
  if (!body?.name) {
    return jsonError(422, "bad_shape", "name is required");
  }
  const db = getDb();
  db.org = {
    id: nextId("org"),
    name: body.name,
    timezone: body.timezone || "UTC",
    created_at: iso(Date.now()),
  };
  db.onboarding.org_created = true;
  return jsonOk(db.org, 201);
}
