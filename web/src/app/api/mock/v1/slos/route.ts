import type { Slo } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { nextId } from "@/mocks/util";

/** GET /v1/slos — SLO list with burn state (pages.md B10). */
export async function GET() {
  return jsonOk(getDb().slos);
}

/** POST /v1/slos — define an SLO; starts healthy with a full budget. */
export async function POST(req: Request) {
  const body = await readJson<Pick<Slo, "name" | "sli_source" | "target" | "window">>(req);
  if (!body?.name || !body.sli_source || body.target === undefined) {
    return jsonError(422, "bad_shape", "name, sli_source and target are required");
  }
  const db = getDb();
  const slo: Slo = {
    id: nextId("slo"),
    org_id: db.org.id,
    name: body.name,
    sli_source: body.sli_source,
    target: body.target,
    window: body.window ?? "30d",
    current: 100,
    budget_remaining_pct: 100,
    burn_rate: 0,
    state: "healthy",
  };
  db.slos.push(slo);
  return jsonOk(slo, 201);
}
