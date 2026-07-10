"use client";

import { useState } from "react";
import { DateRangeId, CustomDateRange } from "@/components/types/dateRange.types";
import { dateRangeOptions } from "@/components/constants/dateRange.constants";

export function useDateRange(initial: DateRangeId = "today") {
  const [selected, setSelected] = useState<DateRangeId>(initial);
  const [customRange, setCustomRange] = useState<CustomDateRange>({
    from: null,
    to: null,
  });

  const selectedOption = dateRangeOptions.find((opt) => opt.id === selected);

  return {
    options: dateRangeOptions,
    selected,
    selectedOption,
    setSelected,
    customRange,
    setCustomRange,
  };
}