import { jsonError, jsonOk } from "@/mocks/http";
import { rumVitals } from "@/mocks/rum-data";
import { getDb, telemetryReady } from "@/mocks/store";
import { DAY } from "@/mocks/util";

/** GET /v1/rum/vitals — core web vitals LCP/CLS/INP (pages.md B6). */
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
  // fresh org: nothing until the first pageview "arrives" (MI-16)
  if (!telemetryReady(getDb())) {
    return jsonOk({
      lcp_ms: { p50: 0, p75: 0, p95: 0 },
      cls: { p50: 0, p75: 0, p95: 0 },
      inp_ms: { p50: 0, p75: 0, p95: 0 },
      series: [],
    });
  }
  return jsonOk(rumVitals(fromMs, toMs));
}
