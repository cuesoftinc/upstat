"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx } from "clsx";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/**
 * Switch — §8.2b standalone: on/off × default/hover/disabled.
 * W2 Radix convergence: role/aria/keyboard ride @radix-ui/react-switch;
 * track + knob chrome is the W1 Figma-QA'd markup unchanged.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...aria
}: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={aria["aria-label"]}
      className={clsx(
        "relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border",
        "transition-colors duration-[var(--duration-base)] ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        checked ? "border-brand bg-brand" : "border-border bg-bg-elev",
        !disabled && !checked && "hover:border-text-2",
        !disabled && checked && "hover:bg-brand-deep hover:border-brand-deep",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        aria-hidden="true"
        className={clsx(
          "block size-3 rounded-full transition-transform duration-[var(--duration-base)] ease-standard motion-reduce:transition-none",
          // knob on brand fill uses on-brand ink (§2)
          checked
            ? "translate-x-[16px] bg-on-brand"
            : "translate-x-[2px] bg-text-2",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
