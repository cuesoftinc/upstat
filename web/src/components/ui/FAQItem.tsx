"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

export interface FAQItemProps {
  question: string;
  answer: string;
  /** Single-open accordion is orchestrated by the parent (A15). */
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

/** FAQItem — §8.2b iteration-1: expanded/collapsed · 720w accordion, single-open. */
export function FAQItem({ question, answer, expanded, onToggle, className }: FAQItemProps) {
  return (
    <div
      data-expanded={expanded}
      className={clsx("font-ui w-full max-w-[720px] border-b border-border", className)}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-[16px] font-semibold text-text">{question}</span>
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-4 shrink-0 text-text-2 transition-transform duration-[var(--duration-base)] ease-standard motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <p className="pb-4 text-[14px] leading-[1.6] text-text-2">{answer}</p>
      )}
    </div>
  );
}
