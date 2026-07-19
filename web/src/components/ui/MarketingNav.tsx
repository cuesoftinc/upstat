"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Zap } from "lucide-react";
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
 */
export function MarketingNav({ onSignIn, starCount = null, className }: MarketingNavProps) {
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

        <ThemeToggle />
        <Button kind="brand" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    </nav>
  );
}
