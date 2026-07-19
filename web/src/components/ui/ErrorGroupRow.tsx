"use client";

import { clsx } from "clsx";
import type { ErrorGroup } from "@/models";

export interface ErrorGroupRowProps {
  group: ErrorGroup;
  onClick?: () => void;
  className?: string;
}

const STATE_TINT: Record<ErrorGroup["state"], string> = {
  new: "text-brand border-brand/40",
  ongoing: "text-text-2 border-border",
  regressed: "text-crit border-crit/40",
};

/** ErrorGroupRow — §8.2b: fingerprint msg (mono) + count + sparkline + last-seen · new/ongoing/regressed. */
export function ErrorGroupRow({
  group,
  onClick,
  className,
}: ErrorGroupRowProps) {
  const max = Math.max(...group.sparkline, 1);
  return (
    <button
      type="button"
      onClick={onClick}
      data-state={group.state}
      className={clsx(
        "font-ui flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
        className,
      )}
    >
      <span
        className={clsx(
          "shrink-0 rounded-(--radius) border px-1.5 text-[10px] font-medium uppercase tracking-wide",
          STATE_TINT[group.state],
        )}
      >
        {group.state}
      </span>
      <span className="font-data min-w-0 flex-1 truncate text-[13px] text-text">
        {group.message}
      </span>
      <svg
        viewBox={`0 0 ${group.sparkline.length} 16`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ width: 72, height: 16 }}
        // the sparkline yields to the fingerprint message below sm (390)
        className="hidden shrink-0 sm:block"
      >
        {group.sparkline.map((v, i) => (
          <rect
            key={i}
            x={i + 0.15}
            y={16 - (v / max) * 14}
            width={0.7}
            height={(v / max) * 14}
            fill="var(--color-crit)"
            opacity={0.8}
          />
        ))}
      </svg>
      <span className="font-data w-14 shrink-0 text-right text-[12px] tabular-nums text-text">
        {group.count.toLocaleString()}
      </span>
      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-text-2">
        {group.last_seen.slice(11, 16)}
      </span>
    </button>
  );
}
