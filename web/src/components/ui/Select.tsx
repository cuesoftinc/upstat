"use client";

import { clsx } from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Type-ahead variant for long lists — the IANA timezone selector per
   * X-10 (§8.2b: trigger closed / open / open-typeahead / disabled).
   */
  typeahead?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** Select / DropdownMenu — §8.2b; menu on z `dropdown 20`. */
export function Select({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  disabled = false,
  typeahead = false,
  className,
  ...aria
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      typeahead && filter
        ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
        : options,
    [options, typeahead, filter],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    if (typeahead) inputRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, typeahead]);

  const selected = options.find((o) => o.value === value) ?? null;

  const commit = (option: SelectOption) => {
    onValueChange(option.value);
    setOpen(false);
    setFilter("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      commit(filtered[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className={clsx("font-ui relative inline-block min-w-40", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={clsx(
          "flex h-8 w-full items-center justify-between gap-2 rounded-(--radius) border px-2",
          "text-[14px] transition-colors duration-[var(--duration-fast)] ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          open ? "border-brand" : "border-border hover:border-text-2",
          disabled && "cursor-not-allowed opacity-60",
          selected ? "text-text" : "text-text-2",
          "bg-bg",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        {/* chevron stays right-pinned at any width (§8.2b fix note) */}
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 text-text-2 transition-transform duration-[var(--duration-fast)]",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={clsx(
            "absolute left-0 top-full z-[var(--z-dropdown)] mt-1 w-full min-w-full",
            "rounded-(--radius) border border-border bg-bg-elev shadow-lg",
          )}
        >
          {typeahead && (
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type to filter…"
              aria-label="Filter options"
              className="font-ui h-8 w-full border-b border-border bg-transparent px-2 text-[13px] text-text placeholder:text-text-2 focus:outline-none"
            />
          )}
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-2 py-1.5 text-[13px] text-text-2">No matches</li>
            )}
            {filtered.map((option, i) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  onClick={() => commit(option)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[13px]",
                    "transition-colors duration-[var(--duration-fast)]",
                    i === activeIndex ? "bg-bg text-text" : "text-text",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
