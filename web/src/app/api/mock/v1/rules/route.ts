import type { AlertRule } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { nextId } from "@/mocks/util";

/** GET /v1/rules — signal-generic monitor rules (data-model.md §5). */
export async function GET() {
  return jsonOk(getDb().rules);
}

/** POST /v1/rules — create a rule; channels must exist. */
export async function POST(req: Request) {
  const body = await readJson<Omit<AlertRule, "id" | "org_id" | "state" | "last_triggered_at">>(req);
  if (!body?.name || !body.signal || !body.thresholds) {
    return jsonError(422, "bad_shape", "name, signal and thresholds are required");
  }
  const db = getDb();
  for (const chId of body.notify?.channel_ids ?? []) {
    const channel = db.channels.find((c) => c.id === chId);
    if (!channel) return jsonError(404, "not_found", `channel ${chId} not found`);
    if (channel.health === "unverified") {
      return jsonError(422, "channel_unverified", `channel ${chId} is not verified`);
    }
  }
  const rule: AlertRule = {
    id: nextId("rule"),
    org_id: db.org.id,
    name: body.name,
    signal: body.signal,
    query: body.query,
    query_string: body.query_string ?? "",
    thresholds: body.thresholds,
    notify: body.notify ?? { channel_ids: [], cooldown_minutes: 10, renotify_minutes: 0, mute_windows: [] },
    state: "ok",
    last_triggered_at: null,
  };
  db.rules.push(rule);
  return jsonOk(rule, 201);
}
