"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export interface WidgetTypeCellProps {
  icon: LucideIcon;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** WidgetTypeCell — §8.2b iteration-1: icon + label tile · default/selected. */
export function WidgetTypeCell({ icon: Icon, label, selected = false, onClick, className }: WidgetTypeCellProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "font-ui flex w-24 flex-col items-center gap-1.5 rounded-(--radius) border p-3",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-bg-elev text-text-2 hover:border-text-2 hover:text-text",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
