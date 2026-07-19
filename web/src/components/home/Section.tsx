"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface SectionProps {
  id?: string;
  title?: string;
  /** Sub-line under the heading (14/text-2). */
  sub?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Home section shell — marketing container canon (design.md §2, decided
 * 2026-07-19): 1152px content centered at the 1440 design width (rails
 * x144/x1296), min 24px gutters below. max-w = 1152 + 2×24 px-6.
 * 28/semibold headings.
 */
export function Section({ id, title, sub, children, className }: SectionProps) {
  return (
    <section
      id={id}
      className={clsx("mx-auto w-full max-w-[1200px] px-6 py-14", className)}
    >
      {title && (
        <h2 className="text-[24px] font-semibold text-text md:text-[28px]">
          {title}
        </h2>
      )}
      {sub && (
        <p className="mt-3 text-[14px] leading-normal text-text-2">{sub}</p>
      )}
      <div className={clsx((title || sub) && "mt-10")}>{children}</div>
    </section>
  );
}
