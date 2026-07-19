import { jsonError, jsonOk, notFound } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/**
 * POST /v1/channels/{id}/verify — flows/alert.md: unverified → verified.
 * Degraded channels must be re-created (verification_expired).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const channel = getDb().channels.find((c) => c.id === id);
  if (!channel) return notFound("channel");
  if (channel.health === "degraded") {
    return jsonError(422, "verification_expired", "verification window expired — recreate the channel");
  }
  channel.health = "verified";
  return jsonOk(channel);
}
