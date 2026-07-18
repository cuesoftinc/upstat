import { jsonOk } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/rum/errors — JS error groups by fingerprint (pages.md B6). */
export async function GET() {
  return jsonOk(getDb().errorGroups);
}
