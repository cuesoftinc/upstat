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
 * selected run (`runRef` from the URL; latest when absent). Deep-linkable
 * state rides the query string per the §4 route-map rule. `?run=` accepts
 * SHAREABLE refs: the internal id (`synrun_0007`) or the visible run
 * number (`482` / `#482`) — the frame addresses runs by #number (audit
 * 2026-07-20; a wrong ref used to silently render the empty state).
 */
export function useSyntheticRunController(
  checkId: string,
  runRef: string | null,
) {
  const check = useRequest(() => syntheticsRepo.get(checkId), [checkId]);
  const runs = useRequest(() => syntheticsRepo.runs(checkId), [checkId]);
  const list = runs.data ?? [];
  const selected = runRef
    ? (list.find((r) => r.id === runRef) ??
      list.find((r) => String(r.number) === runRef.replace(/^#/, "")) ??
      null)
    : (list[0] ?? null);
  /** True when a `?run=` ref was given but matches no run (runs exist). */
  const refNotFound = runRef !== null && selected === null && list.length > 0;
  return { check, runs, selected, refNotFound };
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
