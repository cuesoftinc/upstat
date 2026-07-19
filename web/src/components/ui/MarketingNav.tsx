"use client";

import { useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

export interface MarketingNavProps {
  onSignIn?: () => void;
  /** Live GitHub star count — populated at runtime, never a static number (A13). */
  starCount?: number | null;
  className?: string;
}

/** The canonical nav links (SKILL.md nav-parity canon, 2026-07-19). */
export const NAV_LINKS = [
  { label: "Features", href: "/#pillars", external: false },
  { label: "Dashboards", href: "/dashboard", external: false },
  { label: "Docs", href: "https://cuesoft.gitbook.io/upstat", external: true },
  { label: "GitHub", href: "https://github.com/cuesoftinc/upstat", external: true },
] as const;

/**
 * MarketingNav — nav-parity canon (SKILL.md, 2026-07-19; supersedes the A1
 * pillar-dropdown shape): logo · Features · Dashboards · Docs · GitHub ·
 * ThemeToggle · Sign in CTA (/signin). The GitHub link carries the runtime
 * star count when one arrives — never a static number (§8.2b).
 *
 * The bar (border/background) is full-bleed, but the ROW sits on the
 * marketing container (design.md §2: 1152px content at 1440, rails
 * x144/x1296).
 *
 * Mobile (SKILL.md mobile clause): below `md` the text links collapse into
 * a menu-button disclosure (hamburger, `aria-expanded`) opening a panel
 * with the same 4 links + ThemeToggle + Sign in — no canonical link may be
 * unreachable at any viewport.
 */
export function MarketingNav({ onSignIn, starCount = null, className }: MarketingNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav
      aria-label="Marketing"
      className={clsx(
        "font-ui sticky top-0 z-[var(--z-sticky)] border-b border-border bg-bg",
        className,
      )}
    >
      <div
        // gaps compress below md (375w support); md+ is the QA'd layout.
        // max-w matches the Section shell (max-w-[1200px] px-6 → 1152 content).
        className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-6 md:gap-4"
      >
        {/* landing v2 brand mark (135:2): filled bolt glyph + lowercase wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 text-[16px] font-semibold text-text"
        >
          <Zap
            aria-hidden="true"
            fill="currentColor"
            strokeWidth={0}
            className="size-5 text-brand"
          />
          upstat
        </Link>

        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
            className="hidden text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text md:block"
          >
            {link.label}
            {link.label === "GitHub" && typeof starCount === "number" && (
              <span className="ml-1.5 tabular-nums text-text">
                {starCount.toLocaleString()}
              </span>
            )}
          </a>
        ))}

        <div className="flex-1" />

        <ThemeToggle className="hidden md:block" />
        <Button kind="brand" onClick={onSignIn} className="hidden md:inline-flex">
          Sign in
        </Button>

        {/* mobile disclosure trigger — the panel below carries the links */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="marketing-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-(--radius) p-1.5 text-text-2 transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev hover:text-text md:hidden"
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-4.5" />
          ) : (
            <Menu aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      {menuOpen && (
        <div id="marketing-menu" className="border-t border-border px-6 pt-2 pb-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
              onClick={() => setMenuOpen(false)}
              className="block py-2.5 text-[14px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
            >
              {link.label}
              {link.label === "GitHub" && typeof starCount === "number" && (
                <span className="ml-1.5 tabular-nums text-text">
                  {starCount.toLocaleString()}
                </span>
              )}
            </a>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <ThemeToggle />
            <Button kind="brand" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
