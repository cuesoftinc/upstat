"use client";

import { useCallback } from "react";
import { monitorsRepo } from "@/models/repositories";
import type { Monitor } from "@/models";
import { useRequest } from "./use-request";

/** Monitors controller — uptime checks CRUD + mute (pages.md B7/B8). */
export function useMonitorsController() {
  const state = useRequest(() => monitorsRepo.list(), []);

  const create = useCallback(
    async (input: Pick<Monitor, "name" | "target" | "type"> & Partial<Monitor>) => {
      const monitor = await monitorsRepo.create(input);
      await state.reload();
      return monitor;
    },
    [state],
  );

  const setMuted = useCallback(
    async (id: string, muted: boolean) => {
      await monitorsRepo.update(id, { muted });
      await state.reload();
    },
    [state],
  );

  const remove = useCallback(
    async (id: string) => {
      await monitorsRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  return { ...state, create, setMuted, remove };
}

/** Per-monitor detail: check history + 90-day uptime strip (UptimeCard). */
export function useMonitorController(id: string) {
  const monitor = useRequest(() => monitorsRepo.get(id), [id]);
  const history = useRequest(() => monitorsRepo.history(id), [id]);
  return { monitor, history };
}
