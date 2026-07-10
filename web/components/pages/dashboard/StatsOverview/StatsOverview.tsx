"use client";

import { Icon } from "@iconify/react";
import { DateRangeId } from "@/components/types/dateRange.types";
import { useStatsOverview } from "@/components/hooks/useStatsOverview";
import { formatCompactNumber, formatSignedPercent } from "@/components/utils/formatNumber";
import {
  Row,
  Card,
  Label,
  ValueRow,
  Value,
  Change,
  SkeletonBlock,
} from "./StatsOverview.styles";

interface StatsOverviewProps {
  range: DateRangeId;
}

export default function StatsOverview({ range }: StatsOverviewProps) {
  const { data, isLoading, isError } = useStatsOverview(range);

  if (isLoading) {
    return (
      <Row>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <SkeletonBlock $height="14px" $width="60%" />
            <SkeletonBlock $height="24px" $width="80%" />
          </Card>
        ))}
      </Row>
    );
  }

  if (isError || !data) {
    return <Label>Couldn&apos;t load stats. Please try again.</Label>;
  }

  return (
    <Row>
      {data.map((stat) => {
        const isPositive = stat.change >= 0;
        const displayValue =
          stat.format === "compact" ? formatCompactNumber(stat.value) : stat.value.toLocaleString();

        return (
          <Card key={stat.id}>
            <Label>{stat.label}</Label>
            <ValueRow>
              <Value>{displayValue}</Value>
              <Change $positive={isPositive}>
                {formatSignedPercent(stat.change)}
                <Icon icon={isPositive ? "mdi:trending-up" : "mdi:trending-down"} width={14} height={14} />
              </Change>
            </ValueRow>
          </Card>
        );
      })}
    </Row>
  );
}