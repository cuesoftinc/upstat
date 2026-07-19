import type { Span, Trace } from "@/models";
import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { hashSeed, iso, mulberry32 } from "@/mocks/util";

/**
 * GET /v1/traces/{id} — waterfall detail. The hero trace (POST /v1/events,
 * 9f86d081…, 6 spans) is seeded verbatim; other summaries expand into
 * deterministic span trees.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (db.heroTrace && id === db.heroTrace.trace_id) return jsonOk(db.heroTrace);

  const summary = db.traceSummaries.find((t) => t.trace_id === id);
  if (!summary) return notFound("trace");

  const r = mulberry32(hashSeed(`spans:${id}`));
  const startMs = Date.parse(summary.start);
  const ops = ["db.query", "cache.get", "http.request", "serialize", "auth.check", "queue.publish"];
  const spans: Span[] = [
    {
      trace_id: id,
      span_id: "s0",
      parent_id: null,
      service: summary.root_service,
      name: summary.root_name,
      start: summary.start,
      duration_ns: Math.round(summary.duration_ms * 1e6),
      status: summary.status,
      attrs: { "http.status_code": summary.status === "error" ? "503" : "200" },
    },
  ];
  let offset = 0.5;
  for (let i = 1; i < summary.span_count; i++) {
    const dur = (summary.duration_ms / summary.span_count) * (0.4 + r() * 1.2);
    spans.push({
      trace_id: id,
      span_id: `s${i}`,
      parent_id: r() < 0.7 ? "s0" : `s${Math.max(1, i - 1)}`,
      service: summary.root_service,
      name: ops[Math.floor(r() * ops.length)],
      start: iso(startMs + offset),
      duration_ns: Math.round(dur * 1e6),
      status: summary.status === "error" && i === summary.span_count - 1 ? "error" : "ok",
      attrs: {},
    });
    offset += dur * 0.8;
  }

  const trace: Trace = { ...summary, spans };
  return jsonOk(trace);
}
