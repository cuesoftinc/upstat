"use client";

import { clsx } from "clsx";
import { X, ZoomIn } from "lucide-react";

export interface ZoomStackChipProps {
  /** Zoom stack depth (MI-3 breadcrumb). */
  depth: number;
  /** Current zoom range label, e.g. `09:12 – 09:40`. */
  label: string;
  onReset?: () => void;
  className?: string;
}

/** ZoomStackChip — MI-3 zoom breadcrumb (§8.2b; a QueryPill re-skin). */
export function ZoomStackChip({ depth, label, onReset, className }: ZoomStackChipProps) {
  return (
    <span
      className={clsx(
        "font-data inline-flex h-6 items-center gap-1.5 rounded-(--radius) border border-border",
        "bg-bg-elev px-1.5 text-[12px] text-text",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:border-brand",
        className,
      )}
    >
      <ZoomIn aria-hidden="true" className="size-3 text-text-2" />
      <span className="tabular-nums text-text-2">×{depth}</span>
      <span className="tabular-nums">{label}</span>
      {onReset && (
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={onReset}
          className="ml-0.5 text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
