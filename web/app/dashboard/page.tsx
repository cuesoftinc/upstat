"use client";

import { useDateRange } from "@/components/hooks/useDateRange";
import DateRangeFilter from "@/components/pages/dashboard/DateRangeFilter";
import StatsOverview from "@/components/pages/dashboard/StatsOverview";
import TotalUsersChart from "@/components/pages/dashboard/TotalUsersChart";
import { ChartsRow } from "@/components/pages/dashboard/ChartsLayout.styles";

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