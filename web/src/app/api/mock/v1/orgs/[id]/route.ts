import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** PATCH /v1/orgs/{id} — org profile: name + IANA timezone (pages.md B12). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  if (!db.org || db.org.id !== id) return notFound("org");
  const body = await readJson<{ name?: string; timezone?: string }>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  if (body.name !== undefined) db.org.name = body.name;
  if (body.timezone !== undefined) db.org.timezone = body.timezone;
  return jsonOk(db.org);
}
