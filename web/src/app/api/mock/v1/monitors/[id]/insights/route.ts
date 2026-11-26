import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (!db.monitors.some((monitor) => monitor.id === id)) {
    return notFound("monitor");
  }
  return jsonOk(
    db.monitorInsights
      .filter((insight) => insight.monitor_id === id)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
      .slice(0, 20),
  );
}
