import { jsonOk, notFound } from "@/mocks/http";
import { replayMonitor } from "@/mocks/replay";
import { getDb } from "@/mocks/store";

/**
 * POST /v1/monitors/{id}/test — MI-9 for uptime checks: 24h response-time
 * replay against latency thresholds derived from the check's timeout.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const monitor = db.monitors.find((m) => m.id === id);
  if (!monitor) return notFound("monitor");
  return jsonOk(replayMonitor(monitor, db.outage));
}
