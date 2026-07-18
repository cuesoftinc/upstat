"use client";

import { useCallback } from "react";
import { dashboardsRepo } from "@/models/repositories";
import type { Widget } from "@/models";
import { useRequest } from "./use-request";

/** Dashboards list controller (pages.md B2). */
export function useDashboardsController() {
  const state = useRequest(() => dashboardsRepo.list(), []);

  const create = useCallback(
    async (name: string) => {
      const dashboard = await dashboardsRepo.create({ name });
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

/** Single-dashboard controller — grid editing + widget CRUD (MI-11/12). */
export function useDashboardController(id: string) {
  const state = useRequest(() => dashboardsRepo.get(id), [id]);

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

  return { ...state, addWidget, updateWidget, removeWidget, rename };
}
