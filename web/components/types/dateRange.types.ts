export type DateRangeId = "today" | "week" | "month" | "year" | "custom";

export interface DateRangeOption {
  id: DateRangeId;
  label: string;
}

export interface CustomDateRange {
  from: Date | null;
  to: Date | null;
}