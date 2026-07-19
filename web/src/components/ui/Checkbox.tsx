"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";

export interface CheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/**
 * Checkbox — §8.2b: checked / unchecked / indeterminate × default / disabled.
 * W2 Radix convergence: role/aria-checked=mixed/keyboard ride
 * @radix-ui/react-checkbox; box + glyph chrome is the W1 Figma-QA'd markup.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...aria
}: CheckboxProps) {
  const isChecked = checked === true;
  const isIndeterminate = checked === "indeterminate";
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      // Radix resolves indeterminate → true on toggle, matching the W1
      // behavior; the public callback stays boolean-only.
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      disabled={disabled}
      aria-label={aria["aria-label"]}
      className={clsx(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-(--radius) border",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        isChecked || isIndeterminate
          ? "border-brand bg-brand text-on-brand"
          : "border-border bg-bg hover:border-text-2",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {isChecked && (
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      )}
      {isIndeterminate && (
        <Minus aria-hidden="true" className="size-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Root>
  );
}
