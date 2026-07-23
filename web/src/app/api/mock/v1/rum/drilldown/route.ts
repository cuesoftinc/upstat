import { jsonError, jsonOk } from "@/mocks/http";
import { buildRumDrilldown } from "@/mocks/rum-drilldown";
import { getDb, telemetryReady } from "@/mocks/store";
import { HOUR } from "@/lib/format";

/**
 * GET /v1/rum/drilldown — B6 analytics drill-down (U6-2, pages.md B6
 * [Designed 2026-07-20]): funnel (page views → sessions → conversions)
 * + weekly-cohort retention over the queried range.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = Date.now();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromMs = from ? Date.parse(from) : now - 4 * HOUR;
  const toMs = to ? Date.parse(to) : now;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return jsonError(422, "ts_out_of_range", "from/to must be RFC3339");
  }
  const db = getDb();
  if (!telemetryReady(db)) {
    return jsonOk({
      funnel: { stages: [], conversion_event: "auth_signin_completed" },
      retention: { weeks: 7, cohorts: [] },
    });
  }
  return jsonOk(buildRumDrilldown(fromMs, toMs, now));
}
