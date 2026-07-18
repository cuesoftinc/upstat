"use client";

import { useCallback, useState } from "react";
import { orgsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

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
