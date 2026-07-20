import { jsonOk } from "@/mocks/http";
import { getDb, telemetryReady } from "@/mocks/store";
import { buildUsageReport, monthLabel } from "@/mocks/usage";

/**
 * GET /v1/usage — B12 usage metering (pages.md B12 [Designed 2026-07-20],
 * OBS-012): month-to-date meters per pillar computed from the seeded
 * telemetry volumes (accuracy canon).
 */
export async function GET() {
  const db = getDb();
  const now = Date.now();
  if (!telemetryReady(db)) {
    return jsonOk({
      month_label: monthLabel(now, db.org.timezone || "UTC"),
      rows: [],
    });
  }
  return jsonOk(buildUsageReport(db, now));
}
