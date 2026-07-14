"use client";

import { useQuery } from "@tanstack/react-query";
import { DateRangeId } from "@/components/types/date-range.types";
import { fetchTotalUsers } from "@/components/libs/api/total-users.api";

export function useTotalUsers(range: DateRangeId) {
  return useQuery({
    queryKey: ["dashboard-total-users", range],
    queryFn: () => fetchTotalUsers(range),
  });
}