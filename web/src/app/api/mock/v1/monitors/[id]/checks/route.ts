import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { monitorHistory } from "@/mocks/uptime-data";

/** GET /v1/monitors/{id}/checks — 90-day strip + recent checks (UptimeCard). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const monitor = db.monitors.find((m) => m.id === id);
  if (!monitor) return notFound("monitor");
  return jsonOk(monitorHistory(monitor, Date.now(), db.outage));
}
