import { jsonError, jsonOk, notFound } from "@/mocks/http";
import { replayRule } from "@/mocks/replay";
import { getDb } from "@/mocks/store";

/**
 * POST /v1/rules/{id}/test — MI-9: replay the last 24h against the rule's
 * thresholds → trigger bands + would-have-fired markers.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const rule = db.rules.find((r) => r.id === id);
  if (!rule) return notFound("rule");
  const result = replayRule(rule, db.outage);
  if ("error" in result) return jsonError(422, "invalid_query", result.error);
  return jsonOk(result);
}
