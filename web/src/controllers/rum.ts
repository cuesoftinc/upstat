"use client";

import { rumRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** RUM controller — summary, vitals, error groups (pages.md B6). */
export function useRumController(range: { from?: string; to?: string } = {}) {
  const summary = useRequest(() => rumRepo.summary(range), [range.from, range.to]);
  const vitals = useRequest(() => rumRepo.vitals(range), [range.from, range.to]);
  const errors = useRequest(() => rumRepo.errors(), []);
  return { summary, vitals, errors };
}
