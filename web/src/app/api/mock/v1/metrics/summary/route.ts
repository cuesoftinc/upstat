import { jsonOk } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/metrics/summary — metrics catalog (pages.md B3). */
export async function GET() {
  return jsonOk(getDb().metricCatalog);
}
