"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardsRepo } from "@/models/repositories";
import type { Dashboard, Widget, WidgetLayout } from "@/models";
import { useRequest } from "./use-request";

/* ------------------------------------------------------------------ */
/* Portable JSON (pages.md B2; api.md §6 "CRUD + portable JSON")        */
/* ------------------------------------------------------------------ */

const WIDGET_TYPES = new Set([
  "timeseries", "query_value", "toplist", "table", "heatmap", "logstream",
  "trace_latency", "slo", "status", "servicemap", "markdown",
]);

export interface PortableDashboard {
  version: 1;
  name: string;
  template_vars: Record<string, string[]>;
  widgets: Omit<Widget, "id" | "dashboard_id">[];
}

/** Serialize a dashboard to the portable definition (ids stripped). */
export function dashboardToPortableJson(dashboard: Dashboard): string {
  const portable: PortableDashboard = {
    version: 1,
    name: dashboard.name,
    template_vars: dashboard.template_vars,
    widgets: dashboard.widgets.map(({ type, title, query, query_string, viz_options, layout }) => ({
      type,
      title,
      query,
      query_string,
      viz_options,
      layout,
    })),
  };
  return JSON.stringify(portable, null, 2);
}

/** Parse + validate a portable definition; throws with a readable message. */
export function parsePortableDashboard(text: string): PortableDashboard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("not valid JSON");
  }
  const obj = raw as Partial<PortableDashboard>;
  if (obj?.version !== 1) throw new Error("unsupported version — expected 1");
  if (!obj.name || typeof obj.name !== "string") throw new Error("name is required");
  if (!Array.isArray(obj.widgets)) throw new Error("widgets must be an array");
  for (const w of obj.widgets) {
    if (!w || typeof w !== "object" || !WIDGET_TYPES.has((w as Widget).type)) {
      throw new Error(`unknown widget type: ${(w as Widget | undefined)?.type ?? "?"}`);
    }
    const layout = (w as Widget).layout;
    if (
      !layout ||
      [layout.x, layout.y, layout.w, layout.h].some((n) => typeof n !== "number")
    ) {
      throw new Error("every widget needs a numeric x/y/w/h layout");
    }
  }
  return {
    version: 1,
    name: obj.name,
    template_vars: obj.template_vars ?? {},
    widgets: obj.widgets.map((w) => ({
      type: w.type,
      title: w.title ?? w.type,
      query: w.query ?? null,
      query_string: w.query_string,
      viz_options: w.viz_options ?? {},
      layout: w.layout,
    })),
  };
}

/** Dashboards list controller (pages.md B2). */
export function useDashboardsController() {
  const state = useRequest(() => dashboardsRepo.list(), []);

  /** Create flow: name → widget picker → the first widget lands placed. */
  const create = useCallback(
    async (name: string, firstWidget?: Omit<Widget, "id" | "dashboard_id">) => {
      const dashboard = await dashboardsRepo.create({ name });
      if (firstWidget) {
        await dashboardsRepo.addWidget(dashboard.id, {
          ...firstWidget,
          layout: { ...firstWidget.layout, x: 0, y: 0 },
        });
      }
      await state.reload();
      return dashboard;
    },
    [state],
  );

  const toggleFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await dashboardsRepo.update(id, { favorite });
      await state.reload();
    },
    [state],
  );

  const remove = useCallback(
    async (id: string) => {
      await dashboardsRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  /** B2 portable JSON import — parse, create, place every widget. */
  const importJson = useCallback(
    async (text: string) => {
      const portable = parsePortableDashboard(text);
      const dashboard = await dashboardsRepo.create({ name: portable.name });
      if (Object.keys(portable.template_vars).length > 0) {
        await dashboardsRepo.update(dashboard.id, { template_vars: portable.template_vars });
      }
      for (const widget of portable.widgets) {
        await dashboardsRepo.addWidget(dashboard.id, widget);
      }
      await state.reload();
      return dashboard;
    },
    [state],
  );

  return { ...state, create, toggleFavorite, remove, importJson };
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

/** Single-dashboard controller — grid editing + widget CRUD (MI-11/12). */
export function useDashboardController(id: string, initialEdit = false) {
  const state = useRequest(() => dashboardsRepo.get(id), [id]);

  // MI-11: `e` toggles edit mode; ?edit=1 lands in it (the create flow).
  // `initialEdit` comes from the view's reactive useSearchParams, so it is
  // correct at mount — no effect needed (window.location would race
  // client-side navigation).
  const [editMode, setEditMode] = useState(initialEdit);
  const [savedPulse, setSavedPulse] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      setEditMode((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pulseSaved = useCallback(() => {
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1200);
  }, []);

  const addWidget = useCallback(
    async (widget: Omit<Widget, "id" | "dashboard_id">) => {
      await dashboardsRepo.addWidget(id, widget);
      await state.reload();
    },
    [id, state],
  );

  const updateWidget = useCallback(
    async (widgetId: string, patch: Partial<Widget>) => {
      await dashboardsRepo.updateWidget(id, widgetId, patch);
      await state.reload();
    },
    [id, state],
  );

  const removeWidget = useCallback(
    async (widgetId: string) => {
      await dashboardsRepo.removeWidget(id, widgetId);
      await state.reload();
    },
    [id, state],
  );

  const rename = useCallback(
    async (name: string) => {
      await dashboardsRepo.update(id, { name });
      await state.reload();
    },
    [id, state],
  );

  /** MI-11 drag/resize commit — persists a widget's grid placement. */
  const moveWidget = useCallback(
    async (widgetId: string, layout: WidgetLayout) => {
      await dashboardsRepo.updateWidget(id, widgetId, { layout });
      await state.reload();
      pulseSaved();
    },
    [id, state, pulseSaved],
  );

  const duplicateWidget = useCallback(
    async (widget: Widget) => {
      await dashboardsRepo.addWidget(id, {
        type: widget.type,
        title: `${widget.title} (copy)`,
        query: widget.query,
        query_string: widget.query_string,
        viz_options: widget.viz_options,
        layout: { ...widget.layout, y: widget.layout.y + widget.layout.h },
      });
      await state.reload();
    },
    [id, state],
  );

  return {
    ...state,
    addWidget,
    updateWidget,
    removeWidget,
    rename,
    moveWidget,
    duplicateWidget,
    editMode,
    setEditMode,
    savedPulse,
    pulseSaved,
  };
}
