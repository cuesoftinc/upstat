import { DateRangeId } from "@/components/types/dateRange.types";
import { StatCardData } from "@/components/types/stats.types";

export async function fetchStatsOverview(
  range: DateRangeId
): Promise<StatCardData[]> {
  const res = await fetch(`/api/dashboard/stats?range=${range}`);

  if (!res.ok) {
    throw new Error("Failed to fetch stats overview");
  }

  return res.json();
}