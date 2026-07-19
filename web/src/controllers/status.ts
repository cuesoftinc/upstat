"use client";

import { statusRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/**
 * Public status page controller (pages.md B7) — unauthenticated read by
 * slug; deliberately outside the /dashboard shell (its own entry point).
 */
export function useStatusPageController(slug: string) {
  return useRequest(() => statusRepo.bySlug(slug), [slug]);
}
