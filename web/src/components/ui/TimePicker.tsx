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
 *
 * Mobile (<md, 390 support): the ~285px preset row overflowed the TopBar —
 * presets and the live toggle collapse away, leaving the calendar icon
 * button, and the absolute-range dialog becomes a fixed full-width sheet
 * under the bar so it can never leave the viewport.
 */
export function TimePicker({
  value,
  onChange,
  live = false,
  onLiveChange,
  className,
}: TimePickerProps) {
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
            "hidden px-2 text-[12px] font-medium tabular-nums transition-colors duration-[var(--duration-fast)] ease-standard md:block",
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
            "flex items-center gap-1 px-2 text-[12px] font-medium md:border-l md:border-border",
            "transition-colors duration-[var(--duration-fast)] ease-standard",
            value === "custom"
              ? "bg-bg-elev text-brand"
              : "text-text-2 hover:text-text",
          )}
        >
          {/* the calendar glyph is the <md collapse affordance; desktop is
              the master's text-only "Custom" */}
          <Calendar aria-hidden="true" className="size-3.5 md:hidden" />
          <span className="hidden md:inline">Custom</span>
        </button>
        {customOpen && (
          <div
            role="dialog"
            aria-label="Absolute range"
            // never leaves the viewport (review class 2026-07-19, expendit):
            // <md a fixed full-width sheet under the bar; md+ right-anchored
            // to the control with the max-w clamp
            className="fixed inset-x-2 top-14 z-[var(--z-dropdown)] flex flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3 shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-1 md:w-max md:max-w-[calc(100vw-16px)]"
            onKeyDown={(e) => {
              if (e.key === "Escape") setCustomOpen(false);
            }}
          >
            {/* master anatomy (43:59): one [from] → [to] row of mono
                values — no visible field labels — over the brand commit
                button; panel p-12 / gap-8 */}
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                aria-label="From"
                className="font-data h-7 min-w-0 flex-1 rounded-(--radius) border border-border bg-bg px-1.5 text-[12px] text-text md:w-44 md:flex-none"
              />
              <span aria-hidden="true" className="text-[12px] text-text-2">
                →
              </span>
              <input
                type="datetime-local"
                aria-label="To"
                className="font-data h-7 min-w-0 flex-1 rounded-(--radius) border border-border bg-bg px-1.5 text-[12px] text-text md:w-44 md:flex-none"
              />
            </div>
            {/* the master's explicit commit affordance — Apply range
                closes the panel and re-commits "custom" (MI-1: the
                URL-synced screen owner reacts to the committed value) */}
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange("custom");
              }}
              className="h-7 self-start rounded-(--radius) bg-brand px-3 text-[12px] font-medium text-on-brand transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-brand-deep"
            >
              Apply range
            </button>
          </div>
        )}
      </div>
      {onLiveChange && (
        <button
          type="button"
          aria-pressed={live}
          onClick={() => onLiveChange(!live)}
          className={clsx(
            "hidden items-center gap-1.5 border-l border-border px-2 text-[12px] font-medium md:flex",
            "transition-colors duration-[var(--duration-fast)] ease-standard",
            live ? "text-brand" : "text-text-2 hover:text-text",
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              "size-1.5 rounded-full",
              live
                ? "animate-pulse bg-brand motion-reduce:animate-none"
                : "bg-text-2",
            )}
          />
          LIVE
        </button>
      )}
    </div>
  );
}
