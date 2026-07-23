import type { SyntheticCheck, SyntheticCheckInput } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { normalizeSteps, validateCheckInput } from "@/mocks/synthetics";
import { iso } from "@/lib/format";
import { nextId } from "@/mocks/util";

/** GET /v1/synthetics — multi-step + browser checks (pages.md B7, OBS-011). */
export async function GET() {
  return jsonOk(getDb().synthetics);
}

/** POST /v1/synthetics — the builder's Save check. */
export async function POST(req: Request) {
  const body = await readJson<Partial<SyntheticCheckInput>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const invalid = validateCheckInput(body);
  if (invalid) return jsonError(422, invalid.code, invalid.message);
  const db = getDb();
  const name = body.name!.trim();
  if (db.synthetics.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return jsonError(422, "name_taken", "a check with this name exists");
  }
  const now = Date.now();
  const check: SyntheticCheck = {
    id: nextId("syn"),
    name,
    kind: body.kind!,
    steps: normalizeSteps(body.steps ?? []),
    browser: body.browser ?? null,
    interval_seconds: body.interval_seconds ?? 1800,
    last_run_id: null,
    last_run_status: null,
    last_run_at: null,
    created_at: iso(now),
    updated_at: iso(now),
  };
  db.synthetics.unshift(check);
  db.syntheticRuns[check.id] = [];
  return jsonOk(check, 201);
}
