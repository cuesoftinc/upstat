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

/**
 * TopBar — §2 layout: org/env switcher · global time picker · search (/) ·
 * bell.
 *
 * Mobile (<md, 390 support): the fixed-width utility cluster (~770px) used
 * to overflow the clipped document — right-side taps side-scrolled the
 * chrome itself (probed 2026-07-19). The cluster now collapses: org name
 * truncates and the env chip hides, the TimePicker collapses to its
 * calendar icon (see TimePicker), search collapses to an icon button
 * (still opens the CommandPalette), ThemeToggle + bell stay as icons.
 */
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
        "font-ui sticky top-0 z-[var(--z-sticky)] flex h-[43px] items-center gap-1.5 md:gap-3",
        "border-b border-border bg-bg px-3",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOrgClick}
        aria-haspopup="menu"
        className="flex min-w-0 items-center gap-1.5 rounded-(--radius) px-2 py-1 text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
      >
        <span className="max-w-[96px] truncate md:max-w-none">{orgName}</span>
        <span className="hidden rounded-(--radius) border border-border px-1 text-[10px] tracking-wide text-text-2 md:inline-block">
          {env}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 text-text-2"
        />
      </button>

      <div className="flex-1" />

      {timePicker}

      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Search"
        className="flex h-8 w-8 items-center justify-center gap-2 rounded-(--radius) border border-border bg-bg-elev text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:border-text-2 md:w-56 md:justify-start md:px-2"
      >
        <Search aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="hidden flex-1 text-left md:block">Search</span>
        <span className="hidden md:inline-flex">
          <KbdChip keys="/" />
        </span>
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
          <CountBadge
            count={unreadCount}
            className="absolute -right-1 -top-1"
          />
        )}
      </button>
    </header>
  );
}
