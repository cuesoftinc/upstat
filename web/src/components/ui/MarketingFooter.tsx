"use client";

import { clsx } from "clsx";
import { Fragment } from "react";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

export interface MarketingFooterProps {
  /** Column set — defaults to the standard A10 columns. */
  columns?: FooterColumn[];
  /**
   * Landing v2 rendering (Figma 135:770): links inline, dot-joined,
   * no brand block, copyright line below. Defaults keep the W1 shape.
   */
  inline?: boolean;
  showBrand?: boolean;
  copyright?: string;
  className?: string;
}

const COLUMNS: FooterColumn[] = [
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
export function MarketingFooter({
  columns = COLUMNS,
  inline = false,
  showBrand = true,
  copyright,
  className,
}: MarketingFooterProps) {
  return (
    <footer className={clsx("font-ui border-t border-border bg-bg px-6 py-10", className)}>
      <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-8">
        {showBrand && (
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
        )}
        {columns.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="flex flex-col gap-1.5">
            <span
              className={
                inline
                  ? // landing v2 headings (135:770): sentence case, text ink
                    "text-[13px] font-semibold text-text"
                  : "text-[12px] font-semibold uppercase tracking-wide text-text-2"
              }
            >
              {col.heading}
            </span>
            {inline ? (
              <span className="text-[13px] text-text-2">
                {col.links.map((link, i) => (
                  <Fragment key={link.label}>
                    {i > 0 && " · "}
                    <a
                      href={link.href}
                      className="transition-colors duration-[var(--duration-fast)] hover:text-text"
                    >
                      {link.label}
                    </a>
                  </Fragment>
                ))}
              </span>
            ) : (
              col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
                >
                  {link.label}
                </a>
              ))
            )}
          </nav>
        ))}
      </div>
      {copyright && (
        <p className="mx-auto mt-8 max-w-5xl text-[12px] text-text-2">{copyright}</p>
      )}
    </footer>
  );
}
