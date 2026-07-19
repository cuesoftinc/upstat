"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Grid3x3,
  Hash,
  LayoutList,
  ScrollText,
  Share2,
  Table as TableIcon,
  Target,
  TrendingUp,
  Type,
} from "lucide-react";
import type { WidgetType } from "@/models";
import { WidgetTypeCell } from "./WidgetTypeCell";

/** The pages.md B2 widget-type list (11 types) with §8.1 glyphs. */
export const WIDGET_TYPES: {
  type: WidgetType;
  label: string;
  icon: LucideIcon;
}[] = [
  { type: "timeseries", label: "Timeseries", icon: TrendingUp },
  { type: "query_value", label: "Query value", icon: Hash },
  { type: "toplist", label: "Top list", icon: LayoutList },
  { type: "table", label: "Table", icon: TableIcon },
  { type: "heatmap", label: "Heatmap", icon: Grid3x3 },
  { type: "logstream", label: "Log stream", icon: ScrollText },
  { type: "trace_latency", label: "Trace latency", icon: Activity },
  { type: "slo", label: "SLO", icon: Target },
  { type: "status", label: "Status", icon: BarChart3 },
  { type: "servicemap", label: "Service map", icon: Share2 },
  { type: "markdown", label: "Markdown", icon: Type },
];

export interface WidgetTypePickerProps {
  /** §8.2b: row (in-shell "Choose a visualization") / grid (create modal). */
  layout?: "row" | "grid";
  selected?: WidgetType | null;
  onSelect?: (type: WidgetType) => void;
  className?: string;
}

/** WidgetTypePicker — §8.2b iteration-1: 11 widget types, composes WidgetTypeCell. */
export function WidgetTypePicker({
  layout = "grid",
  selected = null,
  onSelect,
  className,
}: WidgetTypePickerProps) {
  return (
    <div
      data-layout={layout}
      role="group"
      aria-label="Choose a visualization"
      className={clsx(
        layout === "row"
          ? "flex gap-2 overflow-x-auto"
          : "grid grid-cols-4 gap-2",
        className,
      )}
    >
      {WIDGET_TYPES.map(({ type, label, icon }) => (
        <WidgetTypeCell
          key={type}
          icon={icon}
          label={label}
          selected={selected === type}
          onClick={() => onSelect?.(type)}
        />
      ))}
    </div>
  );
}
