"use client";

import { clsx } from "clsx";
import { Bookmark } from "lucide-react";
import { AvatarStack } from "./Avatar";

export interface SavedViewChipProps {
  name: string;
  /** Org-shared views carry the sharer avatar stack (MI-18, §8.2b). */
  sharedWith?: string[];
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** SavedViewChip — §8.2b: personal / org-shared (avatar stack) · default/active. */
export function SavedViewChip({
  name,
  sharedWith,
  active = false,
  onClick,
  className,
}: SavedViewChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "font-ui inline-flex h-7 items-center gap-1.5 rounded-(--radius) border px-2 text-[12px] font-medium",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        active
          ? "border-brand bg-brand/10 text-brand-text"
          : "border-border bg-bg-elev text-text hover:border-text-2",
        className,
      )}
    >
      <Bookmark aria-hidden="true" className="size-3" />
      <span className="truncate">{name}</span>
      {sharedWith && sharedWith.length > 0 && (
        <AvatarStack names={sharedWith} size={20} max={3} />
      )}
    </button>
  );
}
