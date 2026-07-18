import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { buildTimeseries, parseQuery } from "@/mocks/series";
import { getDb } from "@/mocks/store";
import { DAY } from "@/mocks/util";

const MAX_RANGE_DAYS = 92;

/**
 * POST /v1/query — shared-grammar query endpoint (api.md §6). Returns
 * plausible timeseries (p50/p95 shapes + the INC-42 outage window).
 * Unknown facets error (`invalid_query`), never silent-empty (grammar §3).
 */
export async function POST(req: Request) {
  const body = await readJson<{ q?: string; from?: string; to?: string; step?: string }>(req);
  if (!body?.q || !body.from || !body.to) {
    return jsonError(422, "bad_shape", "q, from and to are required");
  }
  const fromMs = Date.parse(body.from);
  const toMs = Date.parse(body.to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return jsonError(422, "ts_out_of_range", "from/to must be a valid RFC3339 range");
  }
  if (toMs - fromMs > MAX_RANGE_DAYS * DAY) {
    return jsonError(422, "range_too_large", `max range is ${MAX_RANGE_DAYS} days`);
  }

  const parsed = parseQuery(body.q);
  if ("error" in parsed) {
    return jsonError(422, "invalid_query", parsed.error);
  }

  const db = getDb();
  return jsonOk(buildTimeseries(parsed, fromMs, toMs, db.outage));
}
