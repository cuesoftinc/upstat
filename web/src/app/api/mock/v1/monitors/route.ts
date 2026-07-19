import type { Monitor } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** GET /v1/monitors — uptime checks list (pages.md B7). */
export async function GET() {
  return jsonOk(getDb().monitors);
}

/** POST /v1/monitors — create (flows/monitor.md: name_taken, timeout<interval). */
export async function POST(req: Request) {
  const body = await readJson<Partial<Monitor>>(req);
  if (!body?.name || !body.target) {
    return jsonError(422, "bad_shape", "name and target are required");
  }
  const db = getDb();
  if (db.monitors.some((m) => m.name === body.name)) {
    return jsonError(409, "name_taken", "a monitor with this name exists");
  }
  const interval = body.interval_seconds ?? 60;
  const timeout = body.timeout_seconds ?? 10;
  if (timeout >= interval) {
    return jsonError(
      422,
      "timeout_gte_interval",
      "timeout must be below the check interval",
    );
  }
  const monitor: Monitor = {
    id: nextId("mon"),
    name: body.name,
    target: body.target,
    type: body.type ?? "website",
    active: true,
    status: "pending",
    muted: false,
    interval_seconds: interval,
    timeout_seconds: timeout,
    failure_threshold: body.failure_threshold ?? 3,
    consecutive_failures: 0,
    last_checked_at: null,
    last_response_time_ms: null,
    last_status_code: null,
    created_at: iso(Date.now()),
    updated_at: iso(Date.now()),
  };
  db.monitors.push(monitor);
  return jsonOk(monitor, 201);
}
