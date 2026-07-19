"use client";

import { useQuery } from "@tanstack/react-query";
import { DateRangeId } from "@/components/types/date-range.types";
import { fetchStatsOverview } from "@/components/libs/api/stats.api";

export function useStatsOverview(range: DateRangeId) {
  return useQuery({
    queryKey: ["dashboard-stats", range],
    queryFn: () => fetchStatsOverview(range),
  });
}