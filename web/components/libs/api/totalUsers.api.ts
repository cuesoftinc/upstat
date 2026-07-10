import { DateRangeId } from "@/components/types/dateRange.types";
import { TotalUsersResponse } from "@/components/types/totalUsers.types";

export async function fetchTotalUsers(range: DateRangeId): Promise<TotalUsersResponse> {
  const res = await fetch(`/api/dashboard/total-users?range=${range}`);

  if (!res.ok) {
    throw new Error("Failed to fetch total users chart data");
  }

  return res.json();
}