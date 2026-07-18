import { jsonOk } from "@/mocks/http";
import { getDb } from "@/mocks/store";

/** GET /v1/traces — trace explorer list (pages.md B5). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  let service: string | undefined;
  let status: string | undefined;
  for (const term of q.split(/\s+/).filter(Boolean)) {
    const [facet, value] = term.split(":");
    if (facet === "service" && value) service = value;
    if (facet === "status" && value) status = value;
  }

  let list = getDb().traceSummaries;
  if (service) list = list.filter((t) => t.root_service === service);
  if (status) list = list.filter((t) => t.status === status);
  return jsonOk(list.slice(0, limit));
}
