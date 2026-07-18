"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";

export interface QueryPillProps {
  /** Facet, e.g. `service`. */
  facet: string;
  /** Value, e.g. `api-common`. */
  value: string;
  negated?: boolean;
  onRemove?: () => void;
  className?: string;
}

/** QueryPill — tokenized filter chip (`service:api-common`), §8.2 default/hover. */
export function QueryPill({ facet, value, negated = false, onRemove, className }: QueryPillProps) {
  return (
    <span
      className={clsx(
        "font-data inline-flex h-6 items-center gap-1 rounded-(--radius) border border-border",
        "bg-bg-elev px-1.5 text-[12px] text-text",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:border-brand",
        className,
      )}
    >
      {negated && <span className="text-crit">-</span>}
      <span className="text-text-2">{facet}:</span>
      <span>{value}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove filter ${facet}:${value}`}
          onClick={onRemove}
          className="ml-0.5 text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
