import { jsonError, jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { executeRun } from "@/mocks/synthetics";

type Params = { params: Promise<{ id: string }> };

/** GET /v1/synthetics/{id}/runs — newest first. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  if (!db.synthetics.some((c) => c.id === id)) {
    return notFound("synthetic check");
  }
  return jsonOk(db.syntheticRuns[id] ?? []);
}

/**
 * POST /v1/synthetics/{id}/runs — "Run once": executes the check's steps
 * deterministically (per-step results, stop-at-first-failure semantics).
 */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const check = db.synthetics.find((c) => c.id === id);
  if (!check) return notFound("synthetic check");
  if (check.steps.length === 0 && check.kind === "multi_step") {
    return jsonError(422, "steps_required", "the check has no steps to run");
  }
  const runs = (db.syntheticRuns[id] ??= []);
  const nextNumber = runs.length > 0 ? runs[0].number + 1 : 1;
  const run = executeRun(check, nextNumber, Date.now());
  runs.unshift(run);
  check.last_run_id = run.id;
  check.last_run_status = run.status;
  check.last_run_at = run.started_at;
  return jsonOk(run, 201);
}
