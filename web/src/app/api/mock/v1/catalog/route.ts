import type { ServiceCatalogEntry } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { nextId } from "@/mocks/util";

/** GET /v1/catalog — service registry (pages.md B11). */
export async function GET() {
  return jsonOk(getDb().catalog);
}

/** POST /v1/catalog — register a service. */
export async function POST(req: Request) {
  const body = await readJson<Omit<ServiceCatalogEntry, "id">>(req);
  if (!body?.name) return jsonError(422, "bad_shape", "name is required");
  const db = getDb();
  if (db.catalog.some((s) => s.name === body.name)) {
    return jsonError(409, "name_taken", "a service with this name exists");
  }
  const entry: ServiceCatalogEntry = {
    id: nextId("svc"),
    name: body.name,
    owner: body.owner ?? "",
    links: body.links ?? {},
    environments: body.environments ?? [],
    telemetry: body.telemetry ?? { metrics: false, logs: false, traces: false, rum: false },
  };
  db.catalog.push(entry);
  return jsonOk(entry, 201);
}
