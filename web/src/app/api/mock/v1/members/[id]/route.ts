import type { Member } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const member = getDb().members.find((m) => m.id === id);
  if (!member) return notFound("member");
  const body = await readJson<{ role?: Member["role"]; status?: Member["status"] }>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  if (body.role !== undefined) {
    if (member.role === "owner" && body.role !== "owner") {
      return jsonError(422, "last_owner", "the org must keep an owner");
    }
    member.role = body.role;
  }
  if (body.status !== undefined) member.status = body.status;
  return jsonOk(member);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const member = db.members.find((m) => m.id === id);
  if (!member) return notFound("member");
  if (member.role === "owner") {
    return jsonError(422, "last_owner", "the org owner cannot be removed");
  }
  db.members.splice(db.members.indexOf(member), 1);
  return new Response(null, { status: 204 });
}
