import type { Member } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { nextId } from "@/mocks/util";

/** GET /v1/members — the org roster (pages.md B12). */
export async function GET() {
  return jsonOk(getDb().members);
}

/** POST /v1/members — invite by email. */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; role?: Member["role"] }>(req);
  if (!body?.email) return jsonError(422, "bad_shape", "email is required");
  const db = getDb();
  if (db.members.some((m) => m.email === body.email)) {
    return jsonError(409, "already_member", "this email is already on the org");
  }
  const member: Member = {
    id: nextId("usr"),
    name: body.email.split("@")[0],
    email: body.email,
    role: body.role ?? "member",
    status: "invited",
  };
  db.members.push(member);
  return jsonOk(member, 201);
}
