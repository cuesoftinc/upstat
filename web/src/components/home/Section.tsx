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
 * Home section shell — 1100px content column (Figma frame 135:2 uses
 * 170px margins at 1440), 28/semibold headings.
 */
export function Section({ id, title, sub, children, className }: SectionProps) {
  return (
    <section
      id={id}
      className={clsx("mx-auto w-full max-w-[1148px] px-6 py-14", className)}
    >
      {title && (
        <h2 className="text-[24px] font-semibold text-text md:text-[28px]">{title}</h2>
      )}
      {sub && <p className="mt-3 text-[14px] leading-normal text-text-2">{sub}</p>}
      <div className={clsx((title || sub) && "mt-10")}>{children}</div>
    </section>
  );
}
