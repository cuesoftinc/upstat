"use client";

/**
 * Chart data-table affordance — design.md §5: "All charts expose
 * data-table toggle". Not a Figma component set: an accessibility
 * behavior shared by the bespoke SVG/stack charts (TimeseriesPanel,
 * Heatmap, LogHistogram, UptimeCard), rendering the chart's exact data
 * through the existing Table construction (§8.2) inside a scroll-bounded
 * container sized to the chart it replaces.
 */

import { clsx } from "clsx";
import { Table as TableIcon } from "lucide-react";
import { Table, type TableColumn } from "./Table";

export interface ChartTableToggleProps {
  /** True while the table view is shown. */
  active: boolean;
  onToggle: () => void;
  /** Accessible name; also the hover title. */
  label?: string;
  className?: string;
}

/** The toggle button — icon/table (§8.1 set), aria-pressed state. */
export function ChartTableToggle({
  active,
  onToggle,
  label = "View as table",
  className,
}: ChartTableToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={clsx(
        "rounded-(--radius) p-1 transition-colors duration-[var(--duration-fast)] ease-standard",
        active ? "text-brand-text" : "text-text-2 hover:bg-bg hover:text-text",
        className,
      )}
    >
      <TableIcon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

export interface ChartDataTableProps {
  columns: TableColumn[];
  rows: Record<string, string | number | null>[];
  /** Scroll bound — typically the plot height the table replaces. */
  maxHeight?: number;
  className?: string;
}

/** The table view — the §8.2 Table inside a scroll-bounded container. */
export function ChartDataTable({
  columns,
  rows,
  maxHeight,
  className,
}: ChartDataTableProps) {
  return (
    <div
      data-testid="chart-data-table"
      className={clsx("overflow-y-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <Table columns={columns} rows={rows} />
    </div>
  );
}
