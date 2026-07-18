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
export function CountBadge({ count, pulse = false, className }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={clsx(
        "font-ui inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crit",
        "px-1 text-[10px] font-semibold tabular-nums text-[#FFFFFF]", // §2 on-crit note
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

/** BufferedCountChip — the "▼ n new" pill (MI-4, §8.2b). */
export function BufferedCountChip({ count, onClick, className }: BufferedCountChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "font-ui inline-flex h-6 items-center gap-1 rounded-full bg-brand px-2",
        "text-[12px] font-medium text-on-brand",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-brand-deep",
        className,
      )}
    >
      <ChevronDown aria-hidden="true" className="size-3" />
      <span className="tabular-nums">{count}</span> new
    </button>
  );
}
