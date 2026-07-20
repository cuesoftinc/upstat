import type { LogEvent } from "@/models";
import { jsonError, jsonOk } from "@/mocks/http";
import { generateLogs, logHistogram } from "@/mocks/series";
import { getDb, telemetryReady } from "@/mocks/store";
import { HOUR, SECOND, iso } from "@/mocks/util";

/**
 * GET /v1/logs — explorer query + cursor pagination + live tail (pages.md
 * B4, MI-4). `cursor` = RFC3339 exclusive upper bound (older page);
 * `live=1` returns the freshest slice for tail polling.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const live = url.searchParams.get("live") === "1";
  const cursor = url.searchParams.get("cursor");
  // cap 10k — the B4 virtualized explorer's max page (`?limit=`); the
  // generator emits 3 lines/s, so a 1h window can fill it
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 10_000);
  const now = Date.now();

  // minimal facet extraction from the shared grammar (service:/level:)
  let service: string | undefined;
  let level: string | undefined;
  for (const term of q.split(/\s+/).filter(Boolean)) {
    const [facet, value] = term.split(":");
    if (facet === "service" && value) service = value;
    if (facet === "level" && value) level = value;
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromMs = from ? Date.parse(from) : now - HOUR;
  let beforeMs = to ? Date.parse(to) : now;
  if (Number.isNaN(fromMs) || Number.isNaN(beforeMs)) {
    return jsonError(422, "ts_out_of_range", "from/to must be RFC3339");
  }

  if (live) beforeMs = now;
  if (cursor) {
    const cursorMs = Date.parse(cursor);
    if (Number.isNaN(cursorMs))
      return jsonError(422, "bad_shape", "invalid cursor");
    beforeMs = cursorMs;
  }

  const db = getDb();
  // fresh org: silence until the first datapoint "arrives" (MI-16)
  if (!telemetryReady(db)) {
    return jsonOk({ events: [], histogram: [], facets: {} });
  }
  const windowFrom = live ? now - 15 * SECOND : fromMs;
  // hero-trace correlation window: only lines inside it (on its services)
  // carry the hero trace id — log ↔ trace coherence (realism 2026-07-19)
  const hero = db.heroTrace
    ? {
        id: db.heroTrace.trace_id,
        startMs: Date.parse(db.heroTrace.start),
        durationMs: db.heroTrace.duration_ms,
        services: [...new Set(db.heroTrace.spans.map((s) => s.service))],
      }
    : undefined;
  const events: LogEvent[] = generateLogs(
    windowFrom,
    beforeMs,
    db.outage,
    service,
    level,
    limit,
    hero,
  );

  const oldest = events[events.length - 1];
  const nextCursor =
    !live && events.length === limit && oldest ? oldest.ts : undefined;

  return jsonOk({
    events,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
    histogram: logHistogram(
      fromMs,
      live ? now : to ? Date.parse(to) : now,
      db.outage,
    ),
    facets: {
      service: facetCounts(events, (e) => e.service),
      level: facetCounts(events, (e) => e.level),
      host: facetCounts(events, (e) => e.host),
    },
    ...(live ? { polled_at: iso(now), poll_interval_ms: 2 * SECOND } : {}),
  });
}

function facetCounts(
  events: LogEvent[],
  pick: (e: LogEvent) => string,
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(pick(e), (counts.get(pick(e)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}
