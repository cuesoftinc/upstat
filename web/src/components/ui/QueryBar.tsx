"use client";

import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { QueryPill } from "./QueryPill";

export interface QueryFilter {
  facet: string;
  value: string;
  negated?: boolean;
}

export interface QuerySuggestion {
  /** Completion text, e.g. `service:` or `service:checkout`. */
  text: string;
  /** Facet cardinality — ranking signal (MI-13). */
  cardinality?: number;
}

export interface QueryBarProps {
  pills: QueryFilter[];
  onRemovePill?: (index: number) => void;
  text: string;
  onTextChange: (text: string) => void;
  onSubmit?: () => void;
  /** Autocomplete suggestions, ranked by cardinality (MI-13). */
  suggestions?: QuerySuggestion[];
  onPickSuggestion?: (suggestion: QuerySuggestion) => void;
  /** Syntax-error state: red underline + hover explanation (MI-13, §8.2). */
  syntaxError?: string | null;
  placeholder?: string;
  className?: string;
}

/** QueryBar — §8.2: empty / pills / autocomplete open / syntax-error. */
export function QueryBar({
  pills,
  onRemovePill,
  text,
  onTextChange,
  onSubmit,
  suggestions = [],
  onPickSuggestion,
  syntaxError = null,
  placeholder = "Filter — e.g. service:api-common status:error",
  className,
}: QueryBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // MI-13: suggestions match what's being typed (last whitespace-separated
  // token), keeping the caller's cardinality ranking — an unfiltered list
  // makes Tab complete something unrelated to the input. Display caps at 8
  // AFTER filtering (a pre-filter cap hides valid matches).
  const token = text.split(/\s+/).pop()?.toLowerCase() ?? "";
  const matching = (
    token ? suggestions.filter((s) => s.text.toLowerCase().includes(token)) : suggestions
  ).slice(0, 8);
  const open = focused && matching.length > 0 && text.length > 0;

  return (
    <div className={clsx("font-ui relative w-full", className)}>
      <div
        data-error={syntaxError ? "true" : undefined}
        className={clsx(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-(--radius) border bg-bg px-2 py-1",
          "transition-colors duration-[var(--duration-fast)] ease-standard",
          syntaxError
            ? "border-crit"
            : focused
              ? "border-brand"
              : "border-border",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Search aria-hidden="true" className="size-3.5 shrink-0 text-text-2" />
        {pills.map((pill, i) => (
          <QueryPill
            key={`${pill.facet}:${pill.value}:${i}`}
            facet={pill.facet}
            value={pill.value}
            negated={pill.negated}
            onRemove={onRemovePill ? () => onRemovePill(i) : undefined}
          />
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit?.();
            if (e.key === "Tab" && open && matching[0]) {
              e.preventDefault();
              onPickSuggestion?.(matching[0]);
            }
          }}
          placeholder={pills.length === 0 ? placeholder : undefined}
          aria-label="Query"
          aria-invalid={syntaxError ? true : undefined}
          className={clsx(
            "font-data min-w-24 flex-1 bg-transparent text-[13px] text-text",
            "placeholder:text-text-2 focus:outline-none",
            syntaxError && "underline decoration-crit decoration-wavy underline-offset-4",
          )}
        />
      </div>

      {syntaxError && (
        <p role="alert" className="mt-1 text-[12px] text-crit">
          {syntaxError}
        </p>
      )}

      {open && (
        <ul
          role="listbox"
          aria-label="Query suggestions"
          className="absolute left-0 top-full z-[var(--z-dropdown)] mt-1 w-full rounded-(--radius) border border-border bg-bg-elev py-1 shadow-lg"
        >
          {matching.map((s) => (
            <li key={s.text}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  onPickSuggestion?.(s);
                }}
                className="font-data flex w-full items-center justify-between px-2 py-1.5 text-left text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg"
              >
                <span>{s.text}</span>
                {s.cardinality !== undefined && (
                  <span className="text-[11px] tabular-nums text-text-2">{s.cardinality}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
