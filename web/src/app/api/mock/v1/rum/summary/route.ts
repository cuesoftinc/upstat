import { jsonError, jsonOk } from "@/mocks/http";
import { rumSummary } from "@/mocks/rum-data";
import { DAY } from "@/mocks/util";

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
    return jsonError(422, "ts_out_of_range", "from/to must be a valid RFC3339 range");
  }
  if (toMs - fromMs > 92 * DAY) {
    return jsonError(422, "range_too_large", "max range is 92 days");
  }
  return jsonOk(rumSummary(fromMs, toMs));
}
