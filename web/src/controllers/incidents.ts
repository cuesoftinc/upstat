"use client";

import { useCallback } from "react";
import { incidentsRepo } from "@/models/repositories";
import type { IncidentPhase } from "@/models";
import { useRequest } from "./use-request";

/** Incidents controller — declare/update + timeline composer (pages.md B9, MI-10). */
export function useIncidentsController() {
  const state = useRequest(() => incidentsRepo.list(), []);

  const declare = useCallback(
    async (input: { title: string; sev: number; commander: string }) => {
      const incident = await incidentsRepo.declare(input);
      await state.reload();
      return incident;
    },
    [state],
  );

  return { ...state, declare };
}

export function useIncidentController(id: string) {
  const incident = useRequest(() => incidentsRepo.get(id), [id]);
  const timeline = useRequest(() => incidentsRepo.timeline(id), [id]);

  const postUpdate = useCallback(
    async (entry: { phase?: IncidentPhase; body: string; author: string }) => {
      await incidentsRepo.postUpdate(id, entry);
      await Promise.all([incident.reload(), timeline.reload()]);
    },
    [id, incident, timeline],
  );

  return { incident, timeline, postUpdate };
}
