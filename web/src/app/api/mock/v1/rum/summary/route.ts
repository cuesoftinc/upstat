import { jsonError, jsonOk } from "@/mocks/http";
import { rumSummary } from "@/mocks/rum-data";
import { getDb, telemetryReady } from "@/mocks/store";
import { DAY } from "@/mocks/util";

const EMPTY_SUMMARY = {
  page_views: 0,
  visits: 0,
  bounce_rate: null,
  avg_visit_seconds: null,
  uniques_daily_avg: 0,
  uniques_additive: false as const,
  series: [],
  top_pages: [],
  top_referrers: [],
  devices: [],
  countries: [],
};

/** GET /v1/rum/summary — page views/visits/bounce + tops (pages.md B6). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const now = Date.now();
  const fromMs = url.searchParams.get("from")
    ? Date.parse(url.searchParams.get("from")!)
    : now - 7 * DAY;
  const toMs = url.searchParams.get("to")
    ? Date.parse(url.searchParams.get("to")!)
    : now;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return jsonError(
      422,
      "ts_out_of_range",
      "from/to must be a valid RFC3339 range",
    );
  }
  if (toMs - fromMs > 92 * DAY) {
    return jsonError(422, "range_too_large", "max range is 92 days");
  }
  // fresh org: nothing until the first pageview "arrives" (MI-16)
  if (!telemetryReady(getDb())) return jsonOk(EMPTY_SUMMARY);
  return jsonOk(rumSummary(fromMs, toMs));
}
