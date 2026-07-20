"use client";

import { clsx } from "clsx";
import { Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import type { LogEvent } from "@/models";
import { LevelChip } from "./LevelChip";

export interface LogLineProps {
  event: LogEvent;
  /** MI-5 signature pivot: ⌘click a value adds `key:value` to the QueryBar. */
  onPivot?: (key: string, value: string) => void;
  defaultExpanded?: boolean;
  /**
   * Controlled expansion (B4 virtualized list: rows unmount when windowed
   * out, so the list owns the expanded set; uncontrolled elsewhere).
   */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

/** Fixed collapsed row height: h-7 button (28px) + 1px border — the B4
 *  windowing constant (`LOG_LINE_ROW_PX` in the logs explorer). */
export const LOG_LINE_ROW_PX = 29;

function formatTs(ts: string): string {
  return ts.slice(11, 23); // HH:MM:SS.mmm
}

// Level ×5 row construction per the master (47:163, ratified §8.2):
// full-row level tint + 3px left level bar on collapsed rows. Colors
// follow the LevelChip mapping [Decided 2026-07-16] (INFO → brand,
// DEBUG → text-2, TRACE → nodata); hover deepens the same tint.
const ROW_TINT: Record<LogEvent["level"], string> = {
  ERROR: "border-l-crit bg-crit/8 hover:bg-crit/15",
  WARN: "border-l-warn bg-warn/8 hover:bg-warn/15",
  INFO: "border-l-brand bg-brand/8 hover:bg-brand/15",
  DEBUG: "border-l-text-2 bg-text-2/8 hover:bg-text-2/15",
  TRACE: "border-l-nodata bg-nodata/8 hover:bg-nodata/15",
};

/** LogLine — §8.2: collapsed / expanded (JSON tree) / level ×5 tints (MI-5). */
export function LogLine({
  event,
  onPivot,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  className,
}: LogLineProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = expandedProp ?? internalExpanded;
  const toggleExpanded = () => {
    if (onExpandedChange) onExpandedChange(!expanded);
    else setInternalExpanded((x) => !x);
  };
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const fields: [string, string][] = [
    ["service", event.service],
    ["level", event.level],
    ["host", event.host],
    ...(event.trace_id
      ? ([["trace_id", event.trace_id]] as [string, string][])
      : []),
    ...Object.entries(event.attrs).map(
      ([k, v]) => [`attrs.${k}`, String(v)] as [string, string],
    ),
  ];

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // clipboard unavailable (non-secure context) — still show feedback
    }
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1200);
  };

  return (
    <div
      data-level={event.level}
      data-expanded={expanded}
      className={clsx(
        "font-data border-b border-border text-[13px]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={(e) => {
          // ⌘click pivots on the service instead of expanding (MI-5)
          if ((e.metaKey || e.ctrlKey) && onPivot) {
            onPivot("service", event.service);
            return;
          }
          toggleExpanded();
        }}
        className={clsx(
          // fixed h-7 (LOG_LINE_ROW_PX): the B4 window relies on one
          // deterministic collapsed height
          "flex h-7 w-full items-center gap-2 px-2 text-left",
          "transition-colors duration-[var(--duration-fast)] ease-standard",
          // level tint-bg + 3px left bar (master 47:163)
          "border-l-[3px]",
          ROW_TINT[event.level],
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className={clsx(
            "size-3 shrink-0 text-text-2 transition-transform duration-[var(--duration-fast)] ease-standard",
            expanded && "rotate-90",
          )}
        />
        <span className="shrink-0 tabular-nums text-text-2">
          {formatTs(event.ts)}
        </span>
        <LevelChip level={event.level} />
        <span className="w-24 shrink-0 truncate text-text-2">
          {event.service}
        </span>
        <span className="min-w-0 flex-1 truncate text-text">
          {event.message}
        </span>
      </button>

      {expanded && (
        <dl className="flex flex-col gap-0.5 border-t border-border bg-bg-elev px-7 py-2">
          {fields.map(([key, value]) => (
            <div
              key={key}
              className="group flex items-center gap-2 text-[12px]"
            >
              <dt className="flex w-40 shrink-0 items-center gap-1 text-text-2">
                {key}
                <button
                  type="button"
                  aria-label={`Copy path ${key}`}
                  onClick={() => void copyPath(key)}
                  className="opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
                >
                  {copiedPath === key ? (
                    <Check className="size-3 text-ok" />
                  ) : (
                    <Copy className="size-3 text-text-2 hover:text-text" />
                  )}
                </button>
              </dt>
              <dd>
                <button
                  type="button"
                  title={`⌘click to filter ${key}:${value}`}
                  onClick={(e) => {
                    if ((e.metaKey || e.ctrlKey) && onPivot)
                      onPivot(key, value);
                  }}
                  className="truncate text-left text-text hover:text-brand"
                >
                  {value}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
