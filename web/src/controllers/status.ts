"use client";

import { useCallback } from "react";
import type { StatusPageConfig } from "@/models";
import { statusRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/**
 * Public status page controller (pages.md B7) — unauthenticated read by
 * slug; deliberately outside the /dashboard shell (its own entry point).
 */
export function useStatusPageController(slug: string) {
  return useRequest(() => statusRepo.bySlug(slug), [slug]);
}

/**
 * B7 status-page builder controller ([Designed 2026-07-20]) — the builder
 * document plus a `save` that persists branding + the ordered component
 * list; every structural mutation (add/rename/reorder/map/delete) saves
 * through here so the public page reflects it immediately.
 */
export function useStatusPageBuilderController() {
  const config = useRequest(() => statusRepo.config(), []);

  const save = useCallback(
    async (next: StatusPageConfig) => {
      const saved = await statusRepo.updateConfig(next);
      await config.reload();
      return saved;
    },
    [config],
  );

  return { config, save };
}
