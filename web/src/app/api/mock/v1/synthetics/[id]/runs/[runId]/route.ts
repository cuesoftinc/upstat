import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

type Params = { params: Promise<{ id: string; runId: string }> };

/** GET /v1/synthetics/{id}/runs/{runId} — one run's per-step results. */
export async function GET(_req: Request, { params }: Params) {
  const { id, runId } = await params;
  const run = (getDb().syntheticRuns[id] ?? []).find((r) => r.id === runId);
  return run ? jsonOk(run) : notFound("synthetic run");
}
