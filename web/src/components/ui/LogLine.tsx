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
  className?: string;
}

function formatTs(ts: string): string {
  return ts.slice(11, 23); // HH:MM:SS.mmm
}

/** LogLine — §8.2: collapsed / expanded (JSON tree) / level ×5 tints (MI-5). */
export function LogLine({
  event,
  onPivot,
  defaultExpanded = false,
  className,
}: LogLineProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
          setExpanded((x) => !x);
        }}
        className={clsx(
          "flex w-full items-center gap-2 px-2 py-1 text-left",
          "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
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
