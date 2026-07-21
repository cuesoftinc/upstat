"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

export interface CountBadgeProps {
  count: number;
  /** pulse-on-increment (§8.2b) — caller flips this when count grows. */
  pulse?: boolean;
  className?: string;
}

/** CountBadge — bell unread dot+n (§8.2b). */
export function CountBadge({
  count,
  pulse = false,
  className,
}: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        "font-ui inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crit",
        "px-1 text-[10px] font-semibold tabular-nums text-on-crit", // §2 on-crit
        pulse && "animate-pulse motion-reduce:animate-none",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export interface BufferedCountChipProps {
  /** Buffered new-line count while live tail is paused (MI-4). */
  count: number;
  onClick?: () => void;
  className?: string;
}

/**
 * BufferedCountChip — the "▼ n new" pill (MI-4, §8.2b). Outlined brand +
 * 12% brand tint, mono label (Figma 94:1556) — not a solid brand fill.
 */
export function BufferedCountChip({
  count,
  onClick,
  className,
}: BufferedCountChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "font-data inline-flex items-center gap-1 rounded-full border border-brand bg-brand/12 px-2 py-[3px]",
        "text-[11px] font-medium text-brand-text",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-brand/20",
        className,
      )}
    >
      <ChevronDown aria-hidden="true" className="size-3" />
      <span className="tabular-nums">{count}</span> new
    </button>
  );
}
