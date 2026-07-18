"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "./Checkbox";

export interface FacetValue {
  value: string;
  count: number;
}

export interface FacetGroupProps {
  /** Facet name, e.g. `service`. */
  name: string;
  values: FacetValue[];
  selected: string[];
  onToggle: (value: string) => void;
  /** §8.2: expanded / collapsed. */
  defaultExpanded?: boolean;
  /** Show top-N then a “show more” affordance (§3 FacetSidebar). */
  topN?: number;
  className?: string;
}

/** FacetGroup — the §3 FacetSidebar group (naming per §8.2). */
export function FacetGroup({
  name,
  values,
  selected,
  onToggle,
  defaultExpanded = true,
  topN = 6,
  className,
}: FacetGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? values : values.slice(0, topN);

  return (
    <div className={clsx("font-ui", className)} data-expanded={expanded}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between py-1.5 text-left"
      >
        <span className="text-[12px] font-semibold uppercase tracking-wide text-text-2">
          {name}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-3.5 text-text-2 transition-transform duration-[var(--duration-fast)] ease-standard",
            !expanded && "-rotate-90",
          )}
        />
      </button>
      {expanded && (
        <ul className="flex flex-col">
          {visible.map((facet) => (
            <li key={facet.value} className="flex items-center gap-2 py-1">
              <Checkbox
                checked={selected.includes(facet.value)}
                onCheckedChange={() => onToggle(facet.value)}
                aria-label={`${name}: ${facet.value}`}
              />
              <button
                type="button"
                onClick={() => onToggle(facet.value)}
                className="flex flex-1 items-center justify-between gap-2 text-left"
              >
                <span className="truncate text-[13px] text-text">{facet.value}</span>
                <span className="text-[11px] tabular-nums text-text-2">{facet.count}</span>
              </button>
            </li>
          ))}
          {values.length > topN && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="py-1 text-[12px] text-brand hover:text-brand-deep"
              >
                {showAll ? "Show less" : `Show all ${values.length}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
