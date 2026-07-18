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
        "font-ui inline-flex h-5 items-center rounded-(--radius) px-1.5 text-[11px] font-semibold",
        sev === 1 && "bg-crit text-[#FFFFFF]", // raw white per the §2 on-crit note
        sev === 2 && "bg-warn text-on-brand",
        sev === 3 && "bg-bg-elev text-text-2 border border-border",
        className,
      )}
    >
      SEV-{sev}
    </span>
  );
}
