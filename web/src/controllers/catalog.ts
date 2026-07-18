"use client";

import { useCallback } from "react";
import { catalogRepo } from "@/models/repositories";
import type { ServiceCatalogEntry } from "@/models";
import { useRequest } from "./use-request";

/** Service catalog controller (pages.md B11). */
export function useCatalogController() {
  const state = useRequest(() => catalogRepo.list(), []);

  const create = useCallback(
    async (input: Omit<ServiceCatalogEntry, "id">) => {
      await catalogRepo.create(input);
      await state.reload();
    },
    [state],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ServiceCatalogEntry>) => {
      await catalogRepo.update(id, patch);
      await state.reload();
    },
    [state],
  );

  return { ...state, create, update };
}
