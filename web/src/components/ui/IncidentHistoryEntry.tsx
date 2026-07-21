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
  /** `timeline` renders the landing v2 treatment (224:11118): phase dot +
   *  rail, tinted phase chip with the timestamp inline, body below; default
   *  keeps the §8.2 label-column list (status page + incident timeline). */
  variant?: "list" | "timeline";
  className?: string;
}

const PHASE_TINT: Record<IncidentPhase, string> = {
  investigating: "text-crit-text",
  identified: "text-warn-text",
  monitoring: "text-brand-text",
  resolved: "text-ok-text",
};

const PHASE_CHIP: Record<IncidentPhase, string> = {
  investigating: "bg-crit/10 text-crit-text",
  identified: "bg-warn/10 text-warn-text",
  monitoring: "bg-brand/10 text-brand-text",
  resolved: "bg-ok/10 text-ok-text",
};

const PHASE_DOT: Record<IncidentPhase, string> = {
  investigating: "bg-crit",
  identified: "bg-warn",
  monitoring: "bg-brand",
  resolved: "bg-ok",
};

/**
 * IncidentHistoryEntry — §8.2: phase investigating / identified / monitoring
 * / resolved · timestamped update list (status page + incident timeline).
 */
export function IncidentHistoryEntry({
  title,
  updates,
  variant = "list",
  className,
}: IncidentHistoryEntryProps) {
  return (
    <article
      className={clsx(
        "font-ui flex flex-col gap-2 border-b border-border py-4",
        className,
      )}
    >
      {title && (
        <h3 className="text-[14px] font-semibold text-text">{title}</h3>
      )}
      <ol className="flex flex-col gap-2">
        {updates.map((update, i) =>
          variant === "timeline" ? (
            <li
              key={`${update.ts}-${i}`}
              data-phase={update.phase}
              className="flex gap-3"
            >
              <span
                aria-hidden="true"
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={clsx(
                    "mt-1 size-2 shrink-0 rounded-full",
                    PHASE_DOT[update.phase],
                  )}
                />
                <span className="w-px flex-1 bg-border" />
              </span>
              <div className="flex min-w-0 flex-col gap-1 pb-3">
                <span className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "font-data rounded-(--radius) px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      PHASE_CHIP[update.phase],
                    )}
                  >
                    {update.phase}
                  </span>
                  <span className="font-data text-[12px] tabular-nums text-text-2">
                    {update.ts.replace("T", " ").slice(0, 16)} UTC
                    {update.author ? ` · ${update.author}` : ""}
                  </span>
                </span>
                <p className="text-[13px] leading-[1.45] text-text">
                  {update.body}
                </p>
              </div>
            </li>
          ) : (
            <li
              key={`${update.ts}-${i}`}
              data-phase={update.phase}
              className="flex gap-3"
            >
              <span
                className={clsx(
                  "w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                  PHASE_TINT[update.phase],
                )}
              >
                {update.phase}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[13px] leading-[1.45] text-text">
                  {update.body}
                </p>
                <span className="text-[11px] tabular-nums text-text-2">
                  {update.ts.replace("T", " ").slice(0, 16)} UTC
                  {update.author ? ` · ${update.author}` : ""}
                </span>
              </div>
            </li>
          ),
        )}
      </ol>
    </article>
  );
}
