import { jsonOk } from "@/mocks/http";
import { resetDb } from "@/mocks/store";

/**
 * POST /v1/testing/reset — test seam: re-seed the mock store (fresh §6
 * narrative). The `testing/` segment keeps it visibly outside the API
 * contract (fleet parity — apparule/expendit). The store is dev-persistent
 * by design; Playwright resets it at journey start so runs stay hermetic on
 * a long-lived server. Mock-only surface — it does not exist in the real
 * API.
 */
export async function POST() {
  resetDb();
  return jsonOk({ reset: true });
}
