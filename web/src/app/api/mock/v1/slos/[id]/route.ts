import { notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.slos.findIndex((s) => s.id === id);
  if (idx === -1) return notFound("slo");
  db.slos.splice(idx, 1);
  return new Response(null, { status: 204 });
}
