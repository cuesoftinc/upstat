"use client";

import { clsx } from "clsx";
import { Star, Users } from "lucide-react";

export interface DashboardListRowProps {
  name: string;
  /** Human updated time, e.g. `2d ago`. */
  updated: string;
  favorite: boolean;
  onFavoriteChange?: (favorite: boolean) => void;
  /** Org-shared indicator (§8.2b). */
  shared?: boolean;
  /** Secondary meta next to the name, e.g. `8 widgets` (Figma 126:323). */
  meta?: string;
  onClick?: () => void;
  className?: string;
}

/** DashboardListRow — §8.2b: favorite star on/off · shared indicator · hover. */
export function DashboardListRow({
  name,
  updated,
  favorite,
  onFavoriteChange,
  shared = false,
  meta,
  onClick,
  className,
}: DashboardListRowProps) {
  return (
    <div
      className={clsx(
        "font-ui flex h-10 items-center gap-3 border-b border-border px-3",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={favorite}
        aria-label={`Favorite ${name}`}
        onClick={() => onFavoriteChange?.(!favorite)}
        className={clsx(
          "transition-colors duration-[var(--duration-fast)]",
          favorite ? "text-warn" : "text-text-2 hover:text-text",
        )}
      >
        <Star className="size-4" fill={favorite ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="truncate text-[13px] font-medium text-text">
          {name}
        </span>
        {shared && (
          <Users
            aria-label="org-shared"
            className="size-3.5 shrink-0 text-text-2"
          />
        )}
        {meta && (
          <span className="shrink-0 text-[12px] text-text-2">{meta}</span>
        )}
      </button>
      <span className="shrink-0 text-[12px] tabular-nums text-text-2">
        {updated}
      </span>
    </div>
  );
}
