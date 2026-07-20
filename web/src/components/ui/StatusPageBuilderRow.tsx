"use client";

import { clsx } from "clsx";
import { GripVertical, Trash2 } from "lucide-react";
import { Select, type SelectOption } from "./Select";

export interface StatusPageBuilderRowProps {
  /** Public display name — inline rename (design.md §8.2b). */
  name: string;
  onRename: (name: string) => void;
  /** Mapped uptime check id (null = unmapped). */
  monitorId: string | null;
  monitorOptions: SelectOption[];
  onMonitorChange: (monitorId: string) => void;
  onDelete?: () => void;
  /** Keyboard reorder — ArrowUp/ArrowDown on the focused grip. */
  onMove?: (delta: -1 | 1) => void;
  className?: string;
}

/**
 * StatusPageBuilderRow — design.md §8.2b: drag grip · component name
 * (inline rename) · monitor-mapping Select · delete; row order = public
 * page order — the output is the existing /status/{slug} construction
 * (Figma "B7 — Status page builder").
 */
export function StatusPageBuilderRow({
  name,
  onRename,
  monitorId,
  monitorOptions,
  onMonitorChange,
  onDelete,
  onMove,
  className,
}: StatusPageBuilderRowProps) {
  return (
    <div
      className={clsx(
        "font-ui flex h-12 items-center gap-3 rounded-(--radius) border border-border bg-bg-elev px-3",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${name}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onMove?.(-1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onMove?.(1);
          }
        }}
        className="cursor-grab text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
      >
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
      {/* inline rename — a ghost input that reads as text until focused */}
      <input
        value={name}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Component name"
        className={clsx(
          "min-w-0 flex-1 rounded-(--radius) border border-transparent bg-transparent px-1.5 py-1",
          "text-[13px] font-medium text-text outline-none",
          "transition-colors duration-[var(--duration-fast)]",
          "hover:border-border focus:border-brand",
        )}
      />
      <span className="text-[12px] text-text-2">monitor:</span>
      <Select
        options={monitorOptions}
        value={monitorId}
        onValueChange={onMonitorChange}
        placeholder="Unmapped"
        aria-label={`Monitor for ${name}`}
        className="min-w-52"
      />
      <button
        type="button"
        aria-label={`Delete ${name}`}
        onClick={onDelete}
        className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-crit"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
