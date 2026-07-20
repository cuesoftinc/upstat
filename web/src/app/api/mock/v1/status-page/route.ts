import type { StatusPageConfig } from "@/models";
import { jsonError, jsonOk, readJson } from "@/mocks/http";
import { allStores, getDb } from "@/mocks/store";
import { nextId } from "@/mocks/util";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * GET /v1/status-page — the active org's builder document (pages.md B7
 * [Designed 2026-07-20]). Orgs that never published get a blank draft
 * (name prefilled from the org, no slug, no components).
 */
export async function GET() {
  const db = getDb();
  return jsonOk(
    db.statusPage ?? { name: db.org.name, slug: "", components: [] },
  );
}

/**
 * PUT /v1/status-page — persist branding + the ordered component list.
 * Row order is the public page order; `statusSlug` (the public routing
 * key) mirrors the saved slug.
 */
export async function PUT(req: Request) {
  const body = await readJson<Partial<StatusPageConfig>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const db = getDb();

  const name = body.name?.trim();
  if (!name) return jsonError(422, "name_required", "page name is required");
  const slug = body.slug?.trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) {
    return jsonError(
      422,
      "invalid_slug",
      "slug must be lowercase letters, digits and hyphens",
    );
  }
  if (allStores().some((s) => s !== db && s.statusSlug === slug)) {
    return jsonError(422, "slug_taken", "this slug belongs to another org");
  }

  const components = body.components ?? [];
  for (const row of components) {
    if (!row.name?.trim()) {
      return jsonError(
        422,
        "component_name_required",
        "every component needs a name",
      );
    }
    if (
      row.monitor_id !== null &&
      !db.monitors.some((m) => m.id === row.monitor_id)
    ) {
      return jsonError(
        422,
        "monitor_not_found",
        `no uptime check ${row.monitor_id}`,
      );
    }
  }

  db.statusPage = {
    name,
    slug,
    components: components.map((row) => ({
      // client drafts arrive as draft_* — the store re-keys them
      id: row.id && !row.id.startsWith("draft_") ? row.id : nextId("spc"),
      name: row.name.trim(),
      monitor_id: row.monitor_id ?? null,
    })),
  };
  db.statusSlug = slug;
  return jsonOk(db.statusPage);
}
