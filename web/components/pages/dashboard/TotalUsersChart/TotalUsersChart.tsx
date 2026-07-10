"use client";

import { useTheme } from "styled-components";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { DateRangeId } from "@/components/types/dateRange.types";
import { useTotalUsers } from "@/components/hooks/useTotalUsers";
import { formatCompactNumber } from "@/components/utils/formatNumber";
import {
  Card,
  Header,
  Title,
  Legend,
  ChartWrapper,
  TooltipBadge,
} from "./TotalUsersChart.styles";

interface TotalUsersChartProps {
  range: DateRangeId;
}

export default function TotalUsersChart({ range }: TotalUsersChartProps) {
  const theme = useTheme();
  const { data, isLoading, isError } = useTotalUsers(range);

  if (isLoading) {
    return (
      <Card>
        <Header>
          <Title>Total Users</Title>
        </Header>
        <ChartWrapper />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <Title>Couldn&apos;t load chart data.</Title>
      </Card>
    );
  }

  return (
    <Card>
      <Header>
        <Title>Total Users</Title>
        <Legend>Current Views</Legend>
      </Header>

      <ChartWrapper>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={theme.colors.border.subtle}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke={theme.colors.text.muted}
              tick={{ fontSize: 12, fontFamily: theme.typography.fontFamily }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke={theme.colors.text.muted}
              tick={{ fontSize: 12, fontFamily: theme.typography.fontFamily }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatCompactNumber(value)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <TooltipBadge>
                    {label} {formatCompactNumber(payload[0].value as number)}
                  </TooltipBadge>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke={theme.colors.error}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke={theme.colors.brand}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: theme.colors.brand }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </Card>
  );
}