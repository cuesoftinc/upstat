import { jsonOk, notFound } from "@/mocks/http";
import { buildStatusPage } from "@/mocks/status-page";
import { allStores } from "@/mocks/store";

/**
 * GET /v1/status/{slug} — public status page read (pages.md B7;
 * unauthenticated by design, the `GetStatusPage` shape over HTTP).
 * Derived live from the owning org's monitors + incidents, so declaring
 * an incident reflects here immediately (B9 linkage).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const db = allStores().find((s) => s.statusSlug === slug);
  if (!db) return notFound("status page");
  return jsonOk(buildStatusPage(db, slug));
}
