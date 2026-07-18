"use client";

import { clsx } from "clsx";

export interface MarketingFooterProps {
  className?: string;
}

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Platform", href: "/#platform" },
      { label: "Status page", href: "https://status.upstat.cuesoft.io/upstat" },
      { label: "Docs", href: "https://docs.upstat.cuesoft.io" },
    ],
  },
  {
    heading: "Open source",
    links: [
      { label: "GitHub", href: "https://github.com/cuesoftinc/upstat" },
      { label: "Contributing", href: "https://github.com/cuesoftinc/upstat/blob/main/CONTRIBUTING.md" },
      { label: "Roadmap", href: "https://github.com/cuesoftinc/upstat#roadmap" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Discord", href: "https://discord.gg/cuelabs" },
      { label: "CueLABS", href: "https://cuesoft.io" },
    ],
  },
  {
    heading: "Legal",
    links: [{ label: "Privacy (cookieless)", href: "/privacy" }],
  },
];

/** MarketingFooter — pages.md A10: standard + privacy (UPS-005). */
export function MarketingFooter({ className }: MarketingFooterProps) {
  return (
    <footer className={clsx("font-ui border-t border-border bg-bg px-6 py-10", className)}>
      <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-8">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[16px] font-semibold text-text">
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-(--radius) bg-brand text-[12px] font-semibold text-on-brand"
            >
              U
            </span>
            Upstat
          </span>
          <span className="text-[12px] text-text-2">
            Open-source observability by CueLABS. MIT licensed.
          </span>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-text-2">
              {col.heading}
            </span>
            {col.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
}
