import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { createOrg, listOrgs } from "@/mocks/store";

/** GET /v1/orgs — every org the user belongs to (TopBar org switcher). */
export async function GET() {
  return jsonOk(listOrgs());
}

/**
 * POST /v1/orgs — create-org onboarding step (pages.md B1; X-10 tz).
 * Creates a FRESH, empty org and makes it active — the primary seed stays
 * untouched (web-implementation.md §6 second-org narrative).
 */
export async function POST(req: Request) {
  const body = await readJson<{ name?: string; timezone?: string }>(req);
  if (!body?.name) {
    return jsonError(422, "bad_shape", "name is required");
  }
  if (listOrgs().some((o) => o.name.toLowerCase() === body.name!.toLowerCase())) {
    return jsonError(409, "name_taken", "an organization with this name exists");
  }
  const org = createOrg(body.name, body.timezone || "UTC");
  return jsonOk(org, 201);
}
