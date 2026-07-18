"use client";

import { clsx } from "clsx";
import { Fragment } from "react";

export interface KbdChipProps {
  /** Single key (`/`) or chord (`g d` — space-separated, MI-17). */
  keys: string;
  className?: string;
}

/** KbdChip — §8.2b: single key / chord. */
export function KbdChip({ keys, className }: KbdChipProps) {
  const parts = keys.split(" ");
  return (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      {parts.map((key, i) => (
        <Fragment key={`${key}-${i}`}>
          <kbd
            className={clsx(
              "font-data inline-flex h-5 min-w-5 items-center justify-center rounded-(--radius)",
              "border border-border bg-bg-elev px-1 text-[11px] text-text-2",
            )}
          >
            {key}
          </kbd>
          {i < parts.length - 1 && (
            <span className="text-[11px] text-text-2">then</span>
          )}
        </Fragment>
      ))}
    </span>
  );
}
