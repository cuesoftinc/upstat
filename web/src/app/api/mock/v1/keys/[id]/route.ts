import { jsonError, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** DELETE /v1/keys/{id} — revoke (kept in the list as `revoked`). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const key = getDb().keys.find((k) => k.id === id);
  if (!key) return notFound("key");
  if (key.status === "revoked") {
    return jsonError(409, "already_revoked", "key is already revoked");
  }
  key.status = "revoked";
  return new Response(null, { status: 204 });
}
