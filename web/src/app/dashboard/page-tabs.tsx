"use client";

import Link from "next/link";
import { clsx } from "clsx";

export interface PageTab {
  label: string;
  href: string;
  active?: boolean;
}

/** Secondary in-page tab nav (Metrics Explorer/Summary, Traces views…). */
export function PageTabs({ tabs, label }: { tabs: PageTab[]; label: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-4">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={clsx(
            "text-[13px] transition-colors duration-[var(--duration-fast)]",
            tab.active ? "font-medium text-brand" : "text-text-2 hover:text-text",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
