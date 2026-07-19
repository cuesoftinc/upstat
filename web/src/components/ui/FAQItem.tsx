"use client";

import { clsx } from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface FAQItemProps {
  question: string;
  answer: string;
  /** Single-open accordion is orchestrated by the parent (A15). */
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * FAQItem — §8.2b iteration-1: expanded/collapsed · 720w accordion,
 * single-open. Master 165:9412 (landing v2): bg-elev card, radius 8
 * (per the master — deliberately softer than the 4px product radius),
 * question Inter Medium 14 + chevron (right collapsed / up expanded),
 * answer 13/text-2.
 */
export function FAQItem({ question, answer, expanded, onToggle, className }: FAQItemProps) {
  return (
    <div
      data-expanded={expanded}
      className={clsx(
        "font-ui w-full max-w-[720px] rounded-[8px] border border-border bg-bg-elev px-[18px] py-4",
        "flex flex-col",
        expanded && "gap-2.5",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[14px] font-medium text-text">{question}</span>
        {expanded ? (
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 rotate-180 text-text-2" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-2" />
        )}
      </button>
      {expanded && (
        <p className="text-[13px] leading-[1.5] text-text-2">{answer}</p>
      )}
    </div>
  );
}
