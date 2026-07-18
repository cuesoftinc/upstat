"use client";

import { useCallback } from "react";
import { alertsRepo } from "@/models/repositories";
import type { AlertChannel, AlertRule } from "@/models";
import { useRequest } from "./use-request";

/** Alerting controller — channels + rules CRUD + triggered feed (pages.md B8). */
export function useAlertsController() {
  const channels = useRequest(() => alertsRepo.channels(), []);
  const rules = useRequest(() => alertsRepo.rules(), []);
  const feed = useRequest(() => alertsRepo.feed(), []);

  const createChannel = useCallback(
    async (input: Pick<AlertChannel, "kind" | "target">) => {
      await alertsRepo.createChannel(input);
      await channels.reload();
    },
    [channels],
  );

  const removeChannel = useCallback(
    async (id: string) => {
      await alertsRepo.removeChannel(id);
      await channels.reload();
    },
    [channels],
  );

  const createRule = useCallback(
    async (input: Omit<AlertRule, "id" | "org_id" | "state" | "last_triggered_at">) => {
      await alertsRepo.createRule(input);
      await rules.reload();
    },
    [rules],
  );

  const removeRule = useCallback(
    async (id: string) => {
      await alertsRepo.removeRule(id);
      await rules.reload();
    },
    [rules],
  );

  return { channels, rules, feed, createChannel, removeChannel, createRule, removeRule };
}
