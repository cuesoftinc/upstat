"use client";

import { clsx } from "clsx";
import { ShieldCheck } from "lucide-react";
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
  /** Column set — defaults to the canonical parity columns (SKILL.md). */
  columns?: FooterColumn[];
  /**
   * Landing v2 rendering (Figma 135:770): links inline, dot-joined.
   * Defaults keep the stacked-column shape.
   */
  inline?: boolean;
  showBrand?: boolean;
  className?: string;
}

/**
 * Canonical footer columns (SKILL.md "Marketing nav, footer & theme parity
 * canon", ratified 2026-07-19) — Product / Docs / Community / Legal.
 */
const COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#pillars" },
      { label: "Try Cloud", href: "/signin" },
      { label: "Self Host", href: "/#self-host" },
      { label: "Platform", href: "/#pillars" },
    ],
  },
  {
    heading: "Docs",
    links: [
      { label: "Docs", href: "https://cuesoft.gitbook.io/upstat" },
      { label: "Quickstart", href: "https://cuesoft.gitbook.io/upstat/setup" },
      { label: "API reference", href: "https://cuesoft.gitbook.io/upstat/system/api-surface" },
      { label: "Self-host guide", href: "https://cuesoft.gitbook.io/upstat/system/deployment" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "GitHub", href: "https://github.com/cuesoftinc/upstat" },
      { label: "Discord", href: "https://discord.gg/CDfZxxrxbb" },
      { label: "Roadmap", href: "https://cuesoft.gitbook.io/upstat/product/roadmap" },
      { label: "CueLABS™", href: "https://cuelabs.cuesoft.io" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "https://privacy.cuesoft.io" },
      { label: "Terms", href: "https://terms.cuesoft.io" },
      { label: "Status", href: "https://status.cuesoft.io" },
    ],
  },
];

const SECURITY_URL = "https://github.com/cuesoftinc/upstat/blob/main/SECURITY.md";
const LICENSE_URL = "https://github.com/cuesoftinc/upstat/blob/main/LICENSE";

/**
 * MarketingFooter — parity canon (SKILL.md 2026-07-19, supersedes the A10
 * ad-hoc columns): brand block + Product/Docs/Community/Legal columns +
 * legal bar (verbatim copyright with linked "Cuesoft Inc." and "MIT
 * License", language selector — English-only for now, ratified — and the
 * security-policy affordance), in upstat's visual idiom.
 */
export function MarketingFooter({
  columns = COLUMNS,
  inline = false,
  showBrand = true,
  className,
}: MarketingFooterProps) {
  return (
    <footer className={clsx("font-ui border-t border-border bg-bg px-6 py-10", className)}>
      {/* marketing container (design.md §2): footer band is full-bleed, its
          content sits on the 1152 rails (outer px-6 supplies the gutters).
          Sibling-parity mobile structure (2026-07-19): brand + 4 columns in
          ONE responsive grid — full-width brand row at 390, 2-col link
          columns, one 5-col row at md+ (apparule/expendit stacking) */}
      <div
        className={clsx(
          "mx-auto max-w-[1152px]",
          inline
            ? "flex flex-wrap justify-between gap-8"
            : "grid grid-cols-2 gap-8 md:grid-cols-5",
        )}
      >
        {showBrand && (
          <div className={clsx("flex max-w-56 flex-col gap-2", !inline && "col-span-2 md:col-span-1")}>
            <span className="flex items-center gap-2 text-[16px] font-semibold text-text">
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-(--radius) bg-brand text-[12px] font-semibold text-on-brand"
              >
                U
              </span>
              Upstat
            </span>
            <span className="text-[12px] leading-[1.45] text-text-2">
              Open-source observability by CueLABS™. MIT licensed.
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

      {/* legal bar — verbatim copyright (linked marks), language selector
          (English-only, a real control — no i18n yet, ratified) and the
          security-policy affordance. Sibling-parity stacking: © line first,
          utilities as ONE grouped cluster that wraps beneath it at 390 */}
      <div className="mx-auto mt-8 flex max-w-[1152px] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
        <p className="text-[12px] text-text-2">
          ©{" "}
          <a
            href="https://cuesoft.io"
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Cuesoft Inc.
          </a>{" "}
          2026. Upstat.{" "}
          <a
            href="https://cuelabs.cuesoft.io"
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            CueLABS™ Division
          </a>
          .{" "}
          <a
            href={LICENSE_URL}
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            MIT License
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={SECURITY_URL}
            className="flex items-center gap-1.5 text-[12px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Security
          </a>
          <label className="flex items-center gap-1.5 text-[12px] text-text-2">
            <span className="sr-only">Language</span>
            <select
              aria-label="Language"
              defaultValue="en"
              className="rounded-(--radius) border border-border bg-bg-elev px-1.5 py-0.5 text-[12px] text-text-2"
            >
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}
