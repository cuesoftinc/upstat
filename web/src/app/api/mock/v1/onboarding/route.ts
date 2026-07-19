import { jsonOk } from "@/mocks/http";
import { getDb, telemetryReady } from "@/mocks/store";

/**
 * GET /v1/onboarding — first-run state (B1: create-org → first data).
 * Fresh orgs resolve `has_data` on a timer (the prototype's AFTER_TIMEOUT
 * convention) — polling this endpoint ends the MI-16 radar sweep.
 */
export async function GET() {
  const db = getDb();
  telemetryReady(db);
  return jsonOk(db.onboarding);
}
