import type { AlertRule } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rule = getDb().rules.find((r) => r.id === id);
  if (!rule) return notFound("rule");
  const body = await readJson<Partial<AlertRule>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const { name, query, query_string, thresholds, notify } = body;
  if (name !== undefined) rule.name = name;
  if (query !== undefined) rule.query = query;
  if (query_string !== undefined) rule.query_string = query_string;
  if (thresholds !== undefined) rule.thresholds = thresholds;
  if (notify !== undefined) rule.notify = notify;
  return jsonOk(rule);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.rules.findIndex((r) => r.id === id);
  if (idx === -1) return notFound("rule");
  db.rules.splice(idx, 1);
  return new Response(null, { status: 204 });
}
