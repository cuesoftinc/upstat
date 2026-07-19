"use client";

import { useCallback, useEffect, useState } from "react";
import { orgsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

const FIRST_DATA_POLL_MS = 1_500;

/** Org + first-run onboarding controller (pages.md B1 first-run flow). */
export function useOnboardingController() {
  const state = useRequest(() => orgsRepo.onboarding(), []);
  const [creating, setCreating] = useState(false);

  const createOrg = useCallback(
    async (name: string, timezone: string) => {
      setCreating(true);
      try {
        const org = await orgsRepo.create({ name, timezone });
        await state.reload();
        return org;
      } finally {
        setCreating(false);
      }
    },
    [state],
  );

  return { ...state, createOrg, creating };
}

/**
 * MI-16 waiting-for-data: poll onboarding until the first datapoint lands
 * (the mock resolves on a timer — AFTER_TIMEOUT). Returns true once data
 * has arrived; the radar sweep stops with its ping and B1 takes over.
 */
export function useFirstDataPoll(enabled: boolean): boolean {
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!enabled || hasData) return;
    let stopped = false;
    const poll = async () => {
      try {
        const onboarding = await orgsRepo.onboarding();
        if (!stopped && onboarding.has_data) setHasData(true);
      } catch {
        // keep polling — onboarding is best-effort
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), FIRST_DATA_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, hasData]);

  return hasData;
}

/** Org profile controller (pages.md B12 — name + IANA timezone per X-10). */
export function useOrgController() {
  const state = useRequest(() => orgsRepo.current(), []);

  const update = useCallback(
    async (patch: { name?: string; timezone?: string }) => {
      if (!state.data) return;
      await orgsRepo.update(state.data.id, patch);
      await state.reload();
    },
    [state],
  );

  return { ...state, update };
}
