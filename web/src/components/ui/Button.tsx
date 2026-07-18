"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ButtonKind = "brand" | "quiet" | "destructive";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** §8.2: kind brand / quiet / destructive; hover+disabled are CSS states. */
  kind?: ButtonKind;
  size?: ButtonSize;
}

/**
 * Button — design.md §8.2. Brand fills carry `on-brand` ink; destructive
 * labels stay raw #FFFFFF per the §2 on-crit decision (documented exception).
 */
export function Button({
  kind = "brand",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-kind={kind}
      className={clsx(
        "font-ui inline-flex items-center justify-center gap-2 rounded-(--radius) font-medium",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[13px]",
        kind === "brand" &&
          "bg-brand text-on-brand hover:bg-brand-deep disabled:hover:bg-brand",
        kind === "quiet" &&
          "border border-border bg-transparent text-text hover:bg-bg-elev disabled:hover:bg-transparent",
        kind === "destructive" &&
          // raw #FFFFFF label pending an `on-crit` token (design.md §2)
          "bg-crit text-[#FFFFFF] hover:opacity-90 disabled:hover:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}
