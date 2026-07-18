"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** §8.2 Input: default / focus / error / disabled. */
  error?: boolean;
  /** Query/data inputs render in JetBrains Mono (design.md §2). */
  mono?: boolean;
}

export function Input({ error = false, mono = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={error || undefined}
      className={clsx(
        "h-8 w-full rounded-(--radius) border bg-bg px-2 text-[14px] text-text",
        mono ? "font-data" : "font-ui",
        "placeholder:text-text-2",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "focus:outline-none focus-visible:outline-none",
        error
          ? "border-crit focus:border-crit"
          : "border-border focus:border-brand",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}
