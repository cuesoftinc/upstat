"use client";

import { clsx } from "clsx";
import type { IncidentPhase } from "@/models";

export interface IncidentHistoryUpdate {
  ts: string;
  phase: IncidentPhase;
  body: string;
  author?: string;
}

export interface IncidentHistoryEntryProps {
  /** Optional — the landing v2 use-case embed (224:11118) renders updates only. */
  title?: string;
  updates: IncidentHistoryUpdate[];
  className?: string;
}

const PHASE_TINT: Record<IncidentPhase, string> = {
  investigating: "text-crit",
  identified: "text-warn",
  monitoring: "text-brand",
  resolved: "text-ok",
};

/**
 * IncidentHistoryEntry — §8.2: phase investigating / identified / monitoring
 * / resolved · timestamped update list (status page + incident timeline).
 */
export function IncidentHistoryEntry({ title, updates, className }: IncidentHistoryEntryProps) {
  return (
    <article className={clsx("font-ui flex flex-col gap-2 border-b border-border py-4", className)}>
      {title && <h3 className="text-[14px] font-semibold text-text">{title}</h3>}
      <ol className="flex flex-col gap-2">
        {updates.map((update, i) => (
          <li key={`${update.ts}-${i}`} data-phase={update.phase} className="flex gap-3">
            <span
              className={clsx(
                "w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                PHASE_TINT[update.phase],
              )}
            >
              {update.phase}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13px] leading-[1.45] text-text">{update.body}</p>
              <span className="text-[11px] tabular-nums text-text-2">
                {update.ts.replace("T", " ").slice(0, 16)} UTC
                {update.author ? ` · ${update.author}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
