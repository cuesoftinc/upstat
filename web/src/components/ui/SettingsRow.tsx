"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface SettingsRowProps {
  label: string;
  description?: string;
  /** Control slot: text / select / toggle (§8.2). */
  control: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** SettingsRow — §8.2: label + description + control slot · default/disabled. */
export function SettingsRow({
  label,
  description,
  control,
  disabled = false,
  className,
}: SettingsRowProps) {
  return (
    <div
      data-disabled={disabled || undefined}
      className={clsx(
        "font-ui flex items-center justify-between gap-6 border-b border-border py-3",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-text">{label}</span>
        {description && (
          <span className="text-[12px] leading-[1.45] text-text-2">
            {description}
          </span>
        )}
      </div>
      {/* inert gates the WHOLE slot: a disabled composite must disable its
          embedded controls too, not just dim them (review class 2026-07-19 —
          apparule's disabled Chip left its ✕ live). */}
      <div className="shrink-0" inert={disabled || undefined}>
        {control}
      </div>
    </div>
  );
}
