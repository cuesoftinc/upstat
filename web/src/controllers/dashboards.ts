"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardsRepo } from "@/models/repositories";
import type { Widget, WidgetLayout } from "@/models";
import { useRequest } from "./use-request";

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

  return { ...state, create, toggleFavorite, remove };
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
