"use client";

import { clsx } from "clsx";
import { Calendar } from "lucide-react";
import { useState } from "react";

export type TimePreset = "15m" | "1h" | "4h" | "1d" | "1w";
export const TIME_PRESETS: TimePreset[] = ["15m", "1h", "4h", "1d", "1w"];

export interface TimePickerProps {
  value: TimePreset | "custom";
  onChange: (preset: TimePreset | "custom") => void;
  /** Live tail toggle — pulsing dot while live (§3). */
  live?: boolean;
  onLiveChange?: (live: boolean) => void;
  className?: string;
}

/**
 * TimePicker — §3/§8.2: presets ×5 + custom + live toggle. Global and
 * URL-synced at screen level (MI-1); this component owns the control UI.
 */
export function TimePicker({ value, onChange, live = false, onLiveChange, className }: TimePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div
      className={clsx(
        "font-ui inline-flex h-8 items-stretch overflow-visible rounded-(--radius) border border-border bg-bg",
        className,
      )}
    >
      {TIME_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={value === preset}
          onClick={() => {
            setCustomOpen(false);
            onChange(preset);
          }}
          className={clsx(
            "px-2 text-[12px] font-medium tabular-nums transition-colors duration-[var(--duration-fast)] ease-standard",
            value === preset
              ? "bg-bg-elev text-brand"
              : "text-text-2 hover:text-text",
          )}
        >
          {preset}
        </button>
      ))}
      <div className="relative flex">
        <button
          type="button"
          aria-pressed={value === "custom"}
          aria-label="Custom range"
          onClick={() => {
            // Always open the absolute-range panel; presets/Escape close it.
            setCustomOpen(true);
            onChange("custom");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setCustomOpen(false);
          }}
          className={clsx(
            "flex items-center gap-1 border-l border-border px-2 text-[12px] font-medium",
            "transition-colors duration-[var(--duration-fast)] ease-standard",
            value === "custom" ? "bg-bg-elev text-brand" : "text-text-2 hover:text-text",
          )}
        >
          <Calendar aria-hidden="true" className="size-3.5" />
          custom
        </button>
        {customOpen && (
          <div
            role="dialog"
            aria-label="Absolute range"
            className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 flex w-64 flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3 shadow-lg"
          >
            <label className="flex flex-col gap-1 text-[12px] text-text-2">
              From
              <input
                type="datetime-local"
                className="font-data h-7 rounded-(--radius) border border-border bg-bg px-1.5 text-[12px] text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-2">
              To
              <input
                type="datetime-local"
                className="font-data h-7 rounded-(--radius) border border-border bg-bg px-1.5 text-[12px] text-text"
              />
            </label>
          </div>
        )}
      </div>
      {onLiveChange && (
        <button
          type="button"
          aria-pressed={live}
          onClick={() => onLiveChange(!live)}
          className={clsx(
            "flex items-center gap-1.5 border-l border-border px-2 text-[12px] font-medium",
            "transition-colors duration-[var(--duration-fast)] ease-standard",
            live ? "text-brand" : "text-text-2 hover:text-text",
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              "size-1.5 rounded-full",
              live ? "animate-pulse bg-brand motion-reduce:animate-none" : "bg-text-2",
            )}
          />
          live
        </button>
      )}
    </div>
  );
}
