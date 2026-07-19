import { jsonOk, notFound } from "@/mocks/http";
import { activateOrg, getDb } from "@/mocks/store";

/** POST /v1/orgs/{id}/activate — switch the active org (TopBar switcher). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!activateOrg(id)) return notFound("org");
  return jsonOk(getDb().org);
}
