import type { Monitor } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/mocks/util";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const monitor = getDb().monitors.find((m) => m.id === id);
  return monitor ? jsonOk(monitor) : notFound("monitor");
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const monitor = getDb().monitors.find((m) => m.id === id);
  if (!monitor) return notFound("monitor");
  const body = await readJson<Partial<Monitor>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  if (body.name !== undefined) monitor.name = body.name;
  if (body.target !== undefined) monitor.target = body.target;
  if (body.type !== undefined) monitor.type = body.type;
  if (body.active !== undefined) monitor.active = body.active;
  if (body.muted !== undefined) monitor.muted = body.muted;
  if (body.interval_seconds !== undefined) monitor.interval_seconds = body.interval_seconds;
  if (body.timeout_seconds !== undefined) monitor.timeout_seconds = body.timeout_seconds;
  if (body.failure_threshold !== undefined) monitor.failure_threshold = body.failure_threshold;
  if (body.active === false) monitor.status = "paused";
  else if (body.active === true && monitor.status === "paused") monitor.status = "pending";
  monitor.updated_at = iso(Date.now());
  return jsonOk(monitor);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.monitors.findIndex((m) => m.id === id);
  if (idx === -1) return notFound("monitor");
  db.monitors.splice(idx, 1);
  return new Response(null, { status: 204 });
}
