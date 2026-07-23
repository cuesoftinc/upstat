import type { Widget } from "@/models";
import { jsonError, jsonOk, notFound, readJson } from "@/mocks/http";
import { getDb } from "@/mocks/store";
import { iso } from "@/lib/format";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const { id, widgetId } = await params;
  const dashboard = getDb().dashboards.find((d) => d.id === id);
  if (!dashboard) return notFound("dashboard");
  const widget = dashboard.widgets.find((w) => w.id === widgetId);
  if (!widget) return notFound("widget");
  const body = await readJson<Partial<Widget>>(req);
  if (!body) return jsonError(400, "bad_shape", "malformed JSON body");
  const { title, query, query_string, viz_options, layout, type } = body;
  if (title !== undefined) widget.title = title;
  if (type !== undefined) widget.type = type;
  if (query !== undefined) widget.query = query;
  if (query_string !== undefined) widget.query_string = query_string;
  if (viz_options !== undefined) widget.viz_options = viz_options;
  if (layout !== undefined) widget.layout = layout;
  dashboard.updated_at = iso(Date.now());
  return jsonOk(widget);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const { id, widgetId } = await params;
  const dashboard = getDb().dashboards.find((d) => d.id === id);
  if (!dashboard) return notFound("dashboard");
  const idx = dashboard.widgets.findIndex((w) => w.id === widgetId);
  if (idx === -1) return notFound("widget");
  dashboard.widgets.splice(idx, 1);
  dashboard.updated_at = iso(Date.now());
  return new Response(null, { status: 204 });
}
