"use client";

import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { LogEvent, LogLevel } from "@/models";
import { LevelChip } from "./LevelChip";
import { LogLine } from "./LogLine";

export interface LogPatternRowProps {
  /** Message template with `<placeholders>` marking clustered variables. */
  template: string;
  count: number;
  dominantLevel: LogLevel;
  /** 7-bucket trend, oldest → newest. */
  trend: number[];
  /** Sample lines rendered indented when expanded. */
  samples: LogEvent[];
  defaultExpanded?: boolean;
  className?: string;
}

function fmtCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(n);
}

/** Placeholder tokens render dimmed — the clustered variables read apart. */
function TemplateText({ template }: { template: string }) {
  return (
    <>
      {template.split(/(<[a-z_]+>)/g).map((part, i) =>
        /^<[a-z_]+>$/.test(part) ? (
          <span key={i} className="text-text-2">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * LogPatternRow — design.md §8.2b: expand chevron · count (tnum) · 7-bucket
 * trend sparkline · Mono template with `<placeholders>` · dominant-level
 * meta; expands to indented sample LogLines (Figma "B4 — Logs (patterns)").
 */
export function LogPatternRow({
  template,
  count,
  dominantLevel,
  trend,
  samples,
  defaultExpanded = false,
  className,
}: LogPatternRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const max = Math.max(...trend, 1);

  return (
    <div className={clsx("font-ui border-b border-border", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((x) => !x)}
        className="flex h-10 w-full items-center gap-3 px-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
      >
        <ChevronRight
          aria-hidden="true"
          className={clsx(
            "size-3.5 shrink-0 text-text-2 transition-transform duration-[var(--duration-fast)]",
            expanded && "rotate-90",
          )}
        />
        <span className="font-data w-14 shrink-0 text-right text-[13px] tabular-nums text-text">
          {fmtCount(count)}
        </span>
        {/* 7-bucket trend sparkline (bespoke SVG, brand fill) */}
        <svg
          aria-hidden="true"
          width={7 * 5 - 2}
          height={14}
          className="shrink-0"
        >
          {trend.map((v, i) => {
            const h = Math.max(2, Math.round((v / max) * 14));
            return (
              <rect
                key={i}
                x={i * 5}
                y={14 - h}
                width={3}
                height={h}
                className="fill-brand"
              />
            );
          })}
        </svg>
        <span className="font-data min-w-0 flex-1 truncate text-[13px] text-text">
          <TemplateText template={template} />
        </span>
        <LevelChip level={dominantLevel} className="shrink-0" />
      </button>
      {expanded && (
        <ul aria-label="Sample lines" className="pb-2 pl-8">
          {samples.map((event) => (
            <li key={event.id}>
              <LogLine event={event} />
            </li>
          ))}
          {samples.length === 0 && (
            <li className="px-2 py-1 text-[12px] text-text-2">
              No sample lines captured for this pattern.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
