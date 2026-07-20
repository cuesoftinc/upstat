import type { SyntheticCheckInput } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { normalizeSteps, validateCheckInput } from "@/mocks/synthetics";
import { iso } from "@/mocks/util";

type Params = { params: Promise<{ id: string }> };

/** GET /v1/synthetics/{id}. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const check = getDb().synthetics.find((c) => c.id === id);
  return check ? jsonOk(check) : notFound("synthetic check");
}

/** PATCH /v1/synthetics/{id} — rename / edit steps / browser panel. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const check = db.synthetics.find((c) => c.id === id);
  if (!check) return notFound("synthetic check");
  const body = await readJson<Partial<SyntheticCheckInput>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const merged: Partial<SyntheticCheckInput> = {
    name: body.name ?? check.name,
    kind: body.kind ?? check.kind,
    steps:
      body.steps ??
      (check.steps.map((s) =>
        s.kind === "http"
          ? { kind: "http", method: s.method!, url: s.url! }
          : s.kind === "assertion"
            ? { kind: "assertion", expression: s.expression! }
            : { kind: "wait", wait_ms: s.wait_ms! },
      ) as SyntheticCheckInput["steps"]),
    browser: body.browser === undefined ? check.browser : body.browser,
  };
  const invalid = validateCheckInput(merged);
  if (invalid) return jsonError(422, invalid.code, invalid.message);
  const name = merged.name!.trim();
  if (
    db.synthetics.some(
      (c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return jsonError(422, "name_taken", "a check with this name exists");
  }
  check.name = name;
  check.kind = merged.kind!;
  if (body.steps) check.steps = normalizeSteps(body.steps);
  if (body.browser !== undefined) check.browser = body.browser;
  if (body.interval_seconds) check.interval_seconds = body.interval_seconds;
  check.updated_at = iso(Date.now());
  return jsonOk(check);
}

/** DELETE /v1/synthetics/{id}. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const idx = db.synthetics.findIndex((c) => c.id === id);
  if (idx === -1) return notFound("synthetic check");
  db.synthetics.splice(idx, 1);
  delete db.syntheticRuns[id];
  return jsonOk({ deleted: true });
}
