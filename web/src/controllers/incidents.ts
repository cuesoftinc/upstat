"use client";

import { useCallback, useState } from "react";
import { incidentsRepo } from "@/models/repositories";
import {
  ApiError,
  type Incident,
  type IncidentPhase,
  type Postmortem,
  type PostmortemInput,
  type TimelineEntry,
} from "@/models";
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
  // B9 postmortem — 404 (none composed yet) resolves to null, not an error
  const postmortem = useRequest<Postmortem | null>(
    () =>
      incidentsRepo.postmortem(id).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
    [id],
  );
  const [savingPostmortem, setSavingPostmortem] = useState(false);
  const [postmortemError, setPostmortemError] = useState<string | null>(null);

  /** Compose/update the postmortem (resolved incidents only, pages.md B9). */
  const savePostmortem = useCallback(
    async (input: PostmortemInput) => {
      setSavingPostmortem(true);
      setPostmortemError(null);
      try {
        await incidentsRepo.savePostmortem(id, input);
        // the incident gains its postmortem_key alongside the doc
        await Promise.all([postmortem.reload(), incident.reload()]);
      } catch (e) {
        setPostmortemError(e instanceof Error ? e.message : "save failed");
        throw e;
      } finally {
        setSavingPostmortem(false);
      }
    },
    [id, postmortem, incident],
  );
  // MI-10: posting an update optimistically prepends; rollback on failure.
  const [optimistic, setOptimistic] = useState<TimelineEntry | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const postUpdate = useCallback(
    async (entry: {
      phase?: IncidentPhase;
      sev?: number;
      body: string;
      author: string;
    }) => {
      const pending: TimelineEntry = {
        id: `pending_${Date.now()}`,
        incident_id: id,
        ts: new Date().toISOString(),
        author: entry.author,
        phase: entry.phase ?? incident.data?.status ?? "investigating",
        body: entry.body,
      };
      setOptimistic(pending);
      setPosting(true);
      setPostError(null);
      try {
        // `/sev n` slash command patches the incident severity (MI-10)
        if (entry.sev && entry.sev !== incident.data?.sev) {
          await incidentsRepo.update(id, { sev: entry.sev as Incident["sev"] });
        }
        await incidentsRepo.postUpdate(id, {
          phase: entry.phase,
          body: entry.body,
          author: entry.author,
        });
        await Promise.all([incident.reload(), timeline.reload()]);
      } catch (e) {
        // rollback the optimistic entry (MI-10)
        setPostError(e instanceof Error ? e.message : "post failed");
        throw e;
      } finally {
        setOptimistic(null);
        setPosting(false);
      }
    },
    [id, incident, timeline],
  );

  /** Timeline including the optimistic prepend, newest-first. */
  const entries: TimelineEntry[] = optimistic
    ? [optimistic, ...(timeline.data ?? [])]
    : (timeline.data ?? []);

  return {
    incident,
    timeline,
    entries,
    postUpdate,
    posting,
    postError,
    postmortem,
    savePostmortem,
    savingPostmortem,
    postmortemError,
  };
}
