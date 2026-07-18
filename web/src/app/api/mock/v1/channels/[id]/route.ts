import { jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const idx = db.channels.findIndex((c) => c.id === id);
  if (idx === -1) return notFound("channel");
  db.channels.splice(idx, 1);
  return new Response(null, { status: 204 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const channel = getDb().channels.find((c) => c.id === id);
  return channel ? jsonOk(channel) : notFound("channel");
}
