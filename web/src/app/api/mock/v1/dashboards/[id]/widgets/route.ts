import type { Widget } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso, nextId } from "@/mocks/util";

/** POST /v1/dashboards/{id}/widgets — add a widget (widget picker, B2). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dashboard = getDb().dashboards.find((d) => d.id === id);
  if (!dashboard) return notFound("dashboard");
  const body = await readJson<Omit<Widget, "id" | "dashboard_id">>(req);
  if (!body?.type) return jsonError(422, "bad_shape", "widget type is required");
  const widget: Widget = {
    id: nextId("wid"),
    dashboard_id: id,
    type: body.type,
    title: body.title ?? "",
    query: body.query ?? null,
    query_string: body.query_string,
    viz_options: body.viz_options ?? {},
    layout: body.layout ?? { x: 0, y: 0, w: 4, h: 3 },
  };
  dashboard.widgets.push(widget);
  dashboard.updated_at = iso(Date.now());
  return jsonOk(widget, 201);
}
