"use client";

import { clsx } from "clsx";
import { Bell, ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { CountBadge } from "./CountBadge";
import { KbdChip } from "./KbdChip";
import { ThemeToggle } from "./ThemeToggle";

export interface TopBarProps {
  orgName: string;
  env?: string;
  onOrgClick?: () => void;
  /** Global TimePicker slot (§8.2b). */
  timePicker?: ReactNode;
  onSearchClick?: () => void;
  /** Bell: idle / unread-badge / flash (MI-14). */
  unreadCount?: number;
  bellFlash?: boolean;
  onBellClick?: () => void;
  className?: string;
}

/** TopBar — §2 layout: org/env switcher · global time picker · search (/) · bell. */
export function TopBar({
  orgName,
  env = "prod",
  onOrgClick,
  timePicker,
  onSearchClick,
  unreadCount = 0,
  bellFlash = false,
  onBellClick,
  className,
}: TopBarProps) {
  return (
    <header
      className={clsx(
        "font-ui sticky top-0 z-[var(--z-sticky)] flex h-12 items-center gap-3",
        "border-b border-border bg-bg px-3",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOrgClick}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-(--radius) px-2 py-1 text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
      >
        {orgName}
        <span className="rounded-(--radius) border border-border px-1 text-[10px] uppercase tracking-wide text-text-2">
          {env}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-text-2" />
      </button>

      <div className="flex-1" />

      {timePicker}

      <button
        type="button"
        onClick={onSearchClick}
        className="flex h-8 w-56 items-center gap-2 rounded-(--radius) border border-border bg-bg-elev px-2 text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:border-text-2"
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <KbdChip keys="/" />
      </button>

      {/* theme-parity canon (SKILL.md 2026-07-19): the toggle lives in the
          chrome utility area, next to the bell */}
      <ThemeToggle />

      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={onBellClick}
        className={clsx(
          "relative rounded-(--radius) p-1.5 text-text-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev hover:text-text",
          bellFlash && "animate-pulse text-crit motion-reduce:animate-none",
        )}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <CountBadge count={unreadCount} className="absolute -right-1 -top-1" />
        )}
      </button>
    </header>
  );
}
