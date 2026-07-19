"use client";

import { useCallback } from "react";
import { monitorsRepo } from "@/models/repositories";
import type { Monitor, MonitorStatus } from "@/models";
import type { StatusPillStatus } from "@/components/ui/StatusPill";
import { useRuleTest } from "./alerts";
import { useRequest } from "./use-request";

/** Monitor state → StatusPill tint (§8.2: paused → nodata tint is the pill's own mapping). */
export function monitorPillStatus(status: MonitorStatus): StatusPillStatus {
  switch (status) {
    case "up":
      return "ok";
    case "down":
      return "crit";
    case "nodata":
      return "nodata";
    case "paused":
      return "paused";
    case "pending":
      return "pending";
  }
}

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

/** B7 overview — UptimeCard strips for the first three live checks. */
export function useUptimeCardsController(monitors: Monitor[] | null) {
  const ids = (monitors ?? [])
    .filter((m) => m.status !== "pending")
    .slice(0, 3)
    .map((m) => m.id)
    .join(",");
  return useRequest(
    async () => {
      if (!ids) return [];
      return Promise.all(ids.split(",").map((id) => monitorsRepo.history(id)));
    },
    [ids],
  );
}

/** Per-monitor detail: check history + 90-day strip + MI-9 test replay. */
export function useMonitorController(id: string) {
  const monitor = useRequest(() => monitorsRepo.get(id), [id]);
  const history = useRequest(() => monitorsRepo.history(id), [id]);
  const test = useRuleTest(useCallback(() => monitorsRepo.test(id), [id]));
  return { monitor, history, ...test };
}
