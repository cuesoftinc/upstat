"use client";

import { clsx } from "clsx";
import { AvatarStack } from "./Avatar";
import { SevChip, type Sev } from "./SevChip";

export interface IncidentBannerProps {
  sev: Sev;
  title: string;
  /** Human age, e.g. `3h`. */
  age: string;
  responders: string[];
  /** Resolved variant is transient (§8.2). */
  resolved?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * IncidentBanner — §8.2: sev1 / sev2 (persistent) · resolved (transient).
 * Hybrid adjudication 2026-07-20: the GLOBAL chrome-strip placement stays
 * (docs §3), with the master's explicit affordances (48:141) — "open 12m"
 * age copy and the "View incident →" / resolved "Postmortem →" link text.
 */
export function IncidentBanner({
  sev,
  title,
  age,
  responders,
  resolved = false,
  onClick,
  className,
}: IncidentBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-resolved={resolved || undefined}
      className={clsx(
        "font-ui flex w-full items-center gap-3 border-b px-4 py-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        resolved
          ? "border-border bg-bg-elev"
          : sev === 1
            ? "border-crit/40 bg-crit/10 hover:bg-crit/15"
            : "border-warn/40 bg-warn/10 hover:bg-warn/15",
        className,
      )}
    >
      {resolved ? (
        <span className="font-ui inline-flex h-5 items-center rounded-(--radius) bg-ok px-1.5 text-[11px] font-semibold text-on-brand">
          RESOLVED
        </span>
      ) : (
        <SevChip sev={sev} />
      )}
      <span className="min-w-0 shrink truncate text-[13px] font-medium text-text">
        {title}
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-text-2">
        {resolved ? age : `open ${age}`}
      </span>
      <span className="min-w-0 flex-1" />
      <AvatarStack names={responders} size={20} />
      {/* the whole strip is the button; the link text is the master's
          explicit affordance */}
      <span className="shrink-0 text-[13px] font-medium text-brand">
        {resolved ? "Postmortem →" : "View incident →"}
      </span>
    </button>
  );
}
