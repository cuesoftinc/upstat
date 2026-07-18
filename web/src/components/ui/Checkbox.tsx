"use client";

import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";

export interface CheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** Checkbox — §8.2b: checked / unchecked / indeterminate × default / disabled. */
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
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndeterminate ? "mixed" : isChecked}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!isChecked)}
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
      {isChecked && <Check aria-hidden="true" className="size-3" strokeWidth={3} />}
      {isIndeterminate && <Minus aria-hidden="true" className="size-3" strokeWidth={3} />}
    </button>
  );
}
