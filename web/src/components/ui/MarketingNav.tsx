"use client";

import { useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, Star, X, Zap } from "lucide-react";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

export interface MarketingNavProps {
  onSignIn?: () => void;
  onTryCloud?: () => void;
  /** Live GitHub star count — populated at runtime, never a static number (A13). */
  starCount?: number | null;
  className?: string;
}

/**
 * The canonical nav links (SKILL.md nav-parity canon, 2026-07-19).
 * Features anchors the feature-highlights band; Platform anchors the
 * 8-pillar grid — differentiated 2026-07-19 (both previously /#pillars).
 */
export const NAV_LINKS = [
  { label: "Features", href: "/#features", external: false },
  { label: "Platform", href: "/#pillars", external: false },
  { label: "Docs", href: "https://cuesoft.gitbook.io/upstat", external: true },
  { label: "GitHub", href: "https://github.com/cuesoftinc/upstat", external: true },
] as const;

/**
 * StarBadge — the GitHub nav item as a compact star chip (canon revision
 * 2026-07-19): star glyph + "Star" + the live runtime count when one
 * arrives. Neutral "Star" in TEST_MODE or on fetch failure — never a
 * static number (§8.2b).
 */
function StarBadge({
  starCount,
  onClick,
  className,
}: {
  starCount: number | null;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <a
      href="https://github.com/cuesoftinc/upstat"
      target="_blank"
      rel="noreferrer"
      aria-label="Star cuesoftinc/upstat on GitHub"
      onClick={onClick}
      className={clsx(
        "items-center gap-1.5 font-medium text-text-2 transition-colors duration-[var(--duration-fast)]",
        className,
      )}
    >
      <Star aria-hidden="true" className="size-3.5" />
      Star
      {typeof starCount === "number" && (
        <span className="tabular-nums text-text">{starCount.toLocaleString()}</span>
      )}
    </a>
  );
}

/**
 * MarketingNav — nav-parity canon (SKILL.md 2026-07-19, revised same day):
 * logo · Features · Platform · Docs · GitHub star badge · ThemeToggle ·
 * Sign in text link · Try Cloud primary CTA (both → /signin).
 *
 * The bar (border/background) is full-bleed, but the ROW sits on the
 * marketing container (design.md §2: 1152px content at 1440, rails
 * x144/x1296).
 *
 * Mobile (SKILL.md mobile clause, [Revised 2026-07-19]): below `md` the
 * bar keeps the Try Cloud CTA beside the hamburger; the menu-button
 * disclosure (`aria-expanded`) opens a panel carrying the 4 links +
 * ThemeToggle + Sign in — no canonical link may be unreachable at any
 * viewport, and the always-visible bar CTA is not duplicated in the panel.
 */
export function MarketingNav({
  onSignIn,
  onTryCloud,
  starCount = null,
  className,
}: MarketingNavProps) {
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

        {NAV_LINKS.map((link) =>
          link.label === "GitHub" ? (
            <StarBadge
              key={link.label}
              starCount={starCount}
              className="hidden h-7 rounded-(--radius) border border-border px-2 text-[12px] hover:border-text-2 hover:text-text md:flex"
            />
          ) : (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="hidden text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text md:block"
            >
              {link.label}
            </a>
          ),
        )}

        <div className="flex-1" />

        <ThemeToggle className="hidden md:block" />
        {/* href carries the semantics (middle-click, copy link); onClick
            halts the hero rAF loop before the transition (useHomeController) */}
        <Link
          href="/signin"
          onClick={onSignIn}
          className="hidden text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text md:block"
        >
          Sign in
        </Link>
        {/* Try Cloud stays in the bar at every viewport ([Revised
            2026-07-19]) — compact below md, standard size on md+. Display
            control lives on wrapper spans: a `hidden` on the Button itself
            fights its base `inline-flex` (same-property utility conflict) */}
        <span className="shrink-0 md:hidden">
          <Button kind="brand" size="sm" onClick={onTryCloud}>
            Try Cloud
          </Button>
        </span>
        <span className="hidden shrink-0 md:block">
          <Button kind="brand" onClick={onTryCloud}>
            Try Cloud
          </Button>
        </span>

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
          {NAV_LINKS.map((link) =>
            link.label === "GitHub" ? (
              <StarBadge
                key={link.label}
                starCount={starCount}
                onClick={() => setMenuOpen(false)}
                className="flex py-2.5 text-[14px] hover:text-text"
              />
            ) : (
              <a
                key={link.label}
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-[14px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
              >
                {link.label}
              </a>
            ),
          )}
          {/* Try Cloud lives in the always-visible bar, not the panel
              ([Revised 2026-07-19] — no duplication) */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <ThemeToggle />
            <Link
              href="/signin"
              onClick={() => {
                setMenuOpen(false);
                onSignIn?.();
              }}
              className="text-[14px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
