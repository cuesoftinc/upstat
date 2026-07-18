"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** §8.2 Input: default / focus / error / disabled. */
  error?: boolean;
  /** Crit hint line under the field (Figma 38:14 error state). */
  errorMessage?: string;
  /** Query/data inputs render in JetBrains Mono (design.md §2). */
  mono?: boolean;
}

export function Input({ error = false, errorMessage, mono = false, className, ...rest }: InputProps) {
  const invalid = error || Boolean(errorMessage);
  const field = (
    <input
      aria-invalid={invalid || undefined}
      className={clsx(
        "h-8 w-full rounded-(--radius) border bg-bg-elev px-2.5 text-[14px] text-text",
        mono ? "font-data" : "font-ui",
        "placeholder:text-text-2",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "focus:outline-none focus-visible:outline-none",
        // 2px ring per the ecosystem focus standard (Figma 38:9/38:14):
        // 1px border + 1px ring, no layout shift.
        invalid
          ? "border-crit ring-1 ring-crit"
          : "border-border focus:border-brand focus:ring-1 focus:ring-brand",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...rest}
    />
  );
  if (!errorMessage) return field;
  return (
    <span className="flex w-full flex-col gap-1.5">
      {field}
      <span role="alert" className="font-ui text-[12px] text-crit">
        {errorMessage}
      </span>
    </span>
  );
}
