"use client";

import { useDateRange } from "@/components/hooks/use-date-range";
import DateRangeFilter from "@/components/pages/dashboard/date-range-filter";
import StatsOverview from "@/components/pages/dashboard/stats-overview";
import TotalUsersChart from "@/components/pages/dashboard/total-users-chart";
import { ChartsRow } from "@/components/pages/dashboard/charts-layout.styles";

export default function Dashboard() {
  const dateRange = useDateRange();

  return (
    <div>
      <DateRangeFilter dateRange={dateRange} />
      <StatsOverview range={dateRange.selected} />

      <ChartsRow>
        <TotalUsersChart range={dateRange.selected} />
       </ChartsRow>
    </div>
  );
}