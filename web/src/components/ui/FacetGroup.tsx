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
      {/* master construction (B4 FacetGroup): chevron LEFT of the
          lowercase medium 12px header — the uppercase/right-chevron
          header was drift (adjudicated 2026-07-20) */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 py-1.5 text-left"
      >
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-3.5 shrink-0 text-text-2 transition-transform duration-[var(--duration-fast)] ease-standard",
            !expanded && "-rotate-90",
          )}
        />
        <span className="text-[12px] font-medium text-text-2">{name}</span>
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
              {/* mono values (12) + mono counts (11) per the master */}
              <button
                type="button"
                onClick={() => onToggle(facet.value)}
                className="flex flex-1 items-center justify-between gap-2 text-left"
              >
                <span className="font-data truncate text-[12px] text-text">
                  {facet.value}
                </span>
                <span className="font-data text-[11px] tabular-nums text-text-2">
                  {facet.count}
                </span>
              </button>
            </li>
          ))}
          {values.length > topN && (
            <li>
              {/* master affordance copy: "Show 12 more" (remaining count,
                  11px) — was "Show all N" at 12px */}
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="py-1 text-[11px] text-brand hover:text-brand-deep"
              >
                {showAll ? "Show less" : `Show ${values.length - topN} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
