import { jsonError, jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { hashSeed } from "@/lib/random";

/**
 * POST /v1/keys/{id}/rotate — rotation contract (data-model.md §2): the
 * previous key stays valid 24h (`rotation_grace`); the new secret is
 * returned once.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const key = getDb().keys.find((k) => k.id === id);
  if (!key) return notFound("key");
  if (key.status === "revoked") {
    return jsonError(409, "already_revoked", "cannot rotate a revoked key");
  }
  const prefix = key.kind === "property_key" ? "pk_live" : "uk_live";
  const secretBody = (hashSeed(`${key.id}:rotate:${Date.now()}`) >>> 0)
    .toString(16)
    .padStart(8, "0")
    .repeat(4)
    .slice(0, 32);
  key.status = "rotation_grace";
  key.key_masked = `${prefix}_${secretBody.slice(0, 4)}…${secretBody.slice(-4)}`;
  return jsonOk({ ...key, key: `${prefix}_${secretBody}` });
}
