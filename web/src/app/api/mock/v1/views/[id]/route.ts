import { notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** DELETE /v1/views/{id} — remove a saved view (MI-18). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.views.findIndex((v) => v.id === id);
  if (idx === -1) return notFound("view");
  db.views.splice(idx, 1);
  return new Response(null, { status: 204 });
}
