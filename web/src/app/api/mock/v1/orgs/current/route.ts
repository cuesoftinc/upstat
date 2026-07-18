import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/orgs/current — the signed-in user's org. */
export async function GET() {
  const db = getDb();
  if (!db.org) return notFound("org");
  return jsonOk(db.org);
}
