import type { ApiKey } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";
import { hashSeed } from "@/lib/random";
import { nextId } from "@/mocks/util";

/** GET /v1/keys — API keys & ingestion tokens (pages.md B12). */
export async function GET() {
  return jsonOk(getDb().keys);
}

/** POST /v1/keys — create; the secret is visible in this response only. */
export async function POST(req: Request) {
  const body = await readJson<{
    kind?: ApiKey["kind"];
    name?: string;
    scope?: ApiKey["scope"];
  }>(req);
  if (!body?.kind || !body.name || !body.scope) {
    return jsonError(422, "bad_shape", "kind, name and scope are required");
  }
  const db = getDb();
  const prefix = body.kind === "property_key" ? "pk_live" : "uk_live";
  const secretBody = (hashSeed(`${body.name}:${Date.now()}`) >>> 0)
    .toString(16)
    .padStart(8, "0")
    .repeat(4)
    .slice(0, 32);
  const secret = `${prefix}_${secretBody}`;
  const key: ApiKey = {
    id: nextId("key"),
    kind: body.kind,
    name: body.name,
    scope: body.scope,
    key_masked: `${prefix}_${secretBody.slice(0, 4)}…${secretBody.slice(-4)}`,
    status: "active",
    created_at: iso(Date.now()),
    rejected_count: 0,
  };
  db.keys.push(key);
  return jsonOk({ ...key, key: secret }, 201);
}
