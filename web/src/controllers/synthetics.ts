"use client";

/**
 * B7 synthetic checks (multi-step / browser, OBS-011) — builder CRUD,
 * "Run once", and the run-view read model (check + runs + selected run).
 */

import { useCallback } from "react";
import type { Monitor, SyntheticCheck, SyntheticCheckInput } from "@/models";
import { monitorsRepo, syntheticsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** List + CRUD for the uptime page's Synthetic checks section. */
export function useSyntheticsController() {
  const state = useRequest(() => syntheticsRepo.list(), []);

  const create = useCallback(
    async (input: SyntheticCheckInput) => {
      const check = await syntheticsRepo.create(input);
      await state.reload();
      return check;
    },
    [state],
  );

  const update = useCallback(
    async (id: string, patch: Partial<SyntheticCheckInput>) => {
      const check = await syntheticsRepo.update(id, patch);
      await state.reload();
      return check;
    },
    [state],
  );

  const remove = useCallback(
    async (id: string) => {
      await syntheticsRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  const runOnce = useCallback(
    async (id: string) => {
      const run = await syntheticsRepo.runOnce(id);
      await state.reload();
      return run;
    },
    [state],
  );

  return { ...state, create, update, remove, runOnce };
}

/** One check for the builder's edit mode. */
export function useSyntheticCheckController(id: string | null) {
  return useRequest(
    () => (id ? syntheticsRepo.get(id) : Promise.resolve(null)),
    [id],
  );
}

/**
 * Run view read model — the check, its run list (newest first) and the
 * selected run (`runId` from the URL; latest when absent). Deep-linkable
 * state rides the query string per the §4 route-map rule.
 */
export function useSyntheticRunController(
  checkId: string,
  runId: string | null,
) {
  const check = useRequest(() => syntheticsRepo.get(checkId), [checkId]);
  const runs = useRequest(() => syntheticsRepo.runs(checkId), [checkId]);
  const selected =
    (runId
      ? (runs.data ?? []).find((r) => r.id === runId)
      : (runs.data ?? [])[0]) ?? null;
  return { check, runs, selected };
}

/**
 * UptimeCard context beside the run timeline — the matched monitor plus
 * its 90-day history (Figma "B7 — Synthetic check run" context card).
 */
export function useSyntheticContext(check: SyntheticCheck | null) {
  const monitors = useRequest(() => monitorsRepo.list(), []);
  const monitor = contextMonitorFor(check, monitors.data);
  const monitorId = monitor?.id ?? null;
  const history = useRequest(
    () => (monitorId ? monitorsRepo.history(monitorId) : Promise.resolve(null)),
    [monitorId],
  );
  return { monitor, history };
}

/**
 * UptimeCard context for the run view: the monitor whose target host the
 * check's first HTTP step hits (derived, not configured — no invented
 * linkage). Null when no monitor watches that host.
 */
export function contextMonitorFor(
  check: SyntheticCheck | null,
  monitors: Monitor[] | null,
): Monitor | null {
  if (!check || !monitors) return null;
  const firstHttp = check.steps.find((s) => s.kind === "http" && s.url);
  const target = firstHttp?.url ?? check.browser?.url;
  if (!target) return null;
  const host = hostOf(target);
  if (!host) return null;
  return monitors.find((m) => hostOf(m.target) === host) ?? null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
