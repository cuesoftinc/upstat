"use client";

import { clsx } from "clsx";

export type Sev = 1 | 2 | 3;

export interface SevChipProps {
  sev: Sev;
  className?: string;
}

/** SevChip — sev1/2/3, extracted from IncidentBanner for reuse (§8.2b). */
export function SevChip({ sev, className }: SevChipProps) {
  return (
    <span
      data-sev={sev}
      className={clsx(
        // never wraps or shrinks — chips stay one line in tight chrome
        // (390 banner regression fix 2026-07-20)
        "font-ui inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-(--radius) px-1.5 text-[11px] font-semibold",
        sev === 1 && "bg-crit text-on-crit", // §2 on-crit: white/light, dark ink/dark
        sev === 2 && "bg-warn text-on-brand",
        sev === 3 && "bg-bg-elev text-text-2 border border-border",
        className,
      )}
    >
      SEV-{sev}
    </span>
  );
}
