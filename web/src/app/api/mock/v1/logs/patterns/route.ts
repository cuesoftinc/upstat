import { jsonError, jsonOk } from "@/mocks/http";
import { clusterLogs } from "@/mocks/log-patterns";
import { getDb, telemetryReady } from "@/mocks/store";
import { HOUR } from "@/mocks/util";

/**
 * GET /v1/logs/patterns — B4 Patterns tab (pages.md B4 [Designed
 * 2026-07-20], OBS-012): clusters the range's lines into templates with
 * `<placeholders>`; shares the explorer's query grammar subset
 * (service:/level: facets + free text) and time-range params.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const now = Date.now();

  let service: string | undefined;
  let level: string | undefined;
  const text: string[] = [];
  for (const term of q.split(/\s+/).filter(Boolean)) {
    const idx = term.indexOf(":");
    if (idx === -1) {
      text.push(term.replace(/^"|"$/g, ""));
      continue;
    }
    const facet = term.slice(0, idx);
    const value = term.slice(idx + 1);
    if (facet === "service" && value) service = value;
    else if (facet === "level" && value) level = value;
    else if (value) text.push(value); // unsupported facets degrade to text
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromMs = from ? Date.parse(from) : now - HOUR;
  const toMs = to ? Date.parse(to) : now;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return jsonError(422, "ts_out_of_range", "from/to must be RFC3339");
  }

  const db = getDb();
  if (!telemetryReady(db)) {
    return jsonOk({
      patterns: [],
      total_lines: 0,
      bucket_ms: 0,
      sampled: false,
    });
  }
  const hero = db.heroTrace
    ? {
        id: db.heroTrace.trace_id,
        startMs: Date.parse(db.heroTrace.start),
        durationMs: db.heroTrace.duration_ms,
        services: [...new Set(db.heroTrace.spans.map((s) => s.service))],
      }
    : undefined;

  return jsonOk(
    clusterLogs(fromMs, toMs, db.outage, { service, level, text }, hero),
  );
}
