import { jsonOk } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/alerts/feed — triggered feed (MI-14; AlertFeedRow). */
export async function GET() {
  return jsonOk(getDb().alertFeed);
}
