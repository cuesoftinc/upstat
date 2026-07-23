import type { AlertChannel } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";
import { nextId } from "@/mocks/util";

/** GET /v1/channels — alert channels (api.md §1a; pages.md B8). */
export async function GET() {
  return jsonOk(getDb().channels);
}

/** POST /v1/channels — create; starts unverified (flows/alert.md). */
export async function POST(req: Request) {
  const body = await readJson<Pick<AlertChannel, "kind" | "target">>(req);
  if (!body?.kind || !body.target) {
    return jsonError(422, "bad_shape", "kind and target are required");
  }
  const channel: AlertChannel = {
    id: nextId("ch"),
    kind: body.kind,
    target: body.target,
    health: "unverified",
    created_at: iso(Date.now()),
  };
  getDb().channels.push(channel);
  return jsonOk(channel, 201);
}
