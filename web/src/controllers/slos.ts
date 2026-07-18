"use client";

import { useCallback } from "react";
import { slosRepo } from "@/models/repositories";
import type { Slo } from "@/models";
import { useRequest } from "./use-request";

/** SLOs controller (pages.md B10, MI-15). */
export function useSlosController() {
  const state = useRequest(() => slosRepo.list(), []);

  const create = useCallback(
    async (
      input: Omit<Slo, "id" | "org_id" | "current" | "budget_remaining_pct" | "burn_rate" | "state">,
    ) => {
      await slosRepo.create(input);
      await state.reload();
    },
    [state],
  );

  const remove = useCallback(
    async (id: string) => {
      await slosRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  return { ...state, create, remove };
}
