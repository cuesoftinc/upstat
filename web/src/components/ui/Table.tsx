"use client";

import { clsx } from "clsx";

export interface TableColumn {
  key: string;
  label: string;
  /** Numeric columns right-align in mono (§8.2). */
  numeric?: boolean;
}

export interface TableProps {
  columns: TableColumn[];
  rows: Record<string, string | number | null>[];
  onRowClick?: (row: Record<string, string | number | null>) => void;
  className?: string;
}

/** Table — §8.2: header + rows, numeric right-aligned mono, compact density. */
export function Table({ columns, rows, onRowClick, className }: TableProps) {
  return (
    // overflow-x-auto: tables never shrink below their content min-width —
    // on narrow viewports the table scrolls inside this wrapper (390 support)
    <div className="overflow-x-auto">
      <table className={clsx("font-ui w-full border-collapse text-[13px]", className)}>
      <thead>
        <tr className="border-b border-border">
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className={clsx(
                "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-2",
                col.numeric ? "text-right" : "text-left",
              )}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={clsx(
              "border-b border-border transition-colors duration-[var(--duration-fast)]",
              onRowClick && "cursor-pointer hover:bg-bg",
            )}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={clsx(
                  "px-2 py-1 text-text",
                  col.numeric && "font-data text-right tabular-nums",
                )}
              >
                {row[col.key] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}
