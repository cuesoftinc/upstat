"use client";

import { clsx } from "clsx";
import type { UsageMeter } from "@/models";

export interface UsageMeterRowProps {
  meter: UsageMeter;
  className?: string;
}

/**
 * UsageMeterRow — design.md §8.2b: pillar + unit label · MTD value (tnum)
 * · bar vs trailing-3-month peak · plan column verbatim "Self-host:
 * unlimited · Cloud: announced at GA" (accuracy canon; Figma "B12 —
 * Settings (usage metering)").
 */
export function UsageMeterRow({ meter, className }: UsageMeterRowProps) {
  const fraction =
    meter.peak <= 0 ? 0 : Math.min(1, meter.value / Math.max(meter.peak, 1));
  const pct = Math.round(fraction * 1000) / 10;
  return (
    <div
      data-pillar={meter.pillar}
      className={clsx(
        "font-ui flex flex-col gap-3 rounded-(--radius) border border-border bg-bg-elev px-4 py-4",
        // 64px row per the master (B12 usage frame 334:14499). Single-line
        // from lg: the fixed label/value columns + nowrap plan need ~740px,
        // so md-and-below keeps the stacked layout (mobile canon — the
        // 768 sweep caught <main> panning when this row went sm:).
        "lg:h-16 lg:flex-row lg:items-center lg:gap-4 lg:py-0",
        className,
      )}
    >
      <span className="w-56 shrink-0 text-[13px] font-medium text-text">
        {meter.label}
      </span>
      <span className="font-data w-20 shrink-0 text-right text-[13px] tabular-nums text-text">
        {meter.display}
      </span>
      <span
        role="meter"
        aria-label={`${meter.label} — month to date vs trailing-3-month peak`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-border"
      >
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </span>
      {/* single line at desktop widths (1440 QA — the fixed w-64 wrapped) */}
      <span className="shrink-0 text-[12px] text-text-2 lg:whitespace-nowrap lg:text-right">
        {meter.plan}
      </span>
    </div>
  );
}
