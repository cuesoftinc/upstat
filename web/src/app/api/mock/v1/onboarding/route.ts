import { jsonOk } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/onboarding — first-run state (B1: create-org → first data). */
export async function GET() {
  return jsonOk(getDb().onboarding);
}
