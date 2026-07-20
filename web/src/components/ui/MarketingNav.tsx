"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { ChevronDown, Menu, Star, X } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { Button } from "./Button";
import { MARKETING_PILLARS, pillarAccent } from "./PillarCard";
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
  {
    label: "GitHub",
    href: "https://github.com/cuesoftinc/upstat",
    external: true,
  },
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
        <span className="tabular-nums text-text">
          {starCount.toLocaleString()}
        </span>
      )}
    </a>
  );
}

/** Hover-close grace so the pointer can cross the 8px gap to the panel. */
const DROPDOWN_CLOSE_DELAY_MS = 150;

/**
 * FeaturesDropdown — the A1 pillar-map dropdown (Figma 98:1709,
 * MarketingNav `state=dropdown-open`): the desktop Features item keeps its
 * canonical `/#features` link (the parity-canon inventory is unchanged —
 * adjudicated 2026-07-20) and gains a disclosure chevron opening the mini
 * feature map ×8 — two 4-row columns of series-accent pillar icons +
 * 13px labels, reusing the PillarCard construction (MARKETING_PILLARS +
 * pillarAccent + the Figma short labels). Hover or chevron-click opens;
 * Escape closes and restores focus to the chevron; focus leaving the
 * cluster closes it. Rows deep-link each pillar's card on the landing
 * grid (`/#pillar-n`). The mobile panel keeps the plain Features link.
 */
function FeaturesDropdown({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      DROPDOWN_CLOSE_DELAY_MS,
    );
  };
  // clear any pending close on unmount
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      data-testid="features-nav-item"
      className="relative hidden items-center gap-1 self-stretch md:flex"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        // focus left the cluster (link, chevron and panel are all inside)
        if (!rootRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <a
        href={href}
        onClick={() => setOpen(false)}
        className={clsx(
          "text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
          open ? "text-brand" : "text-text-2 hover:text-text",
        )}
      >
        Features
      </a>
      <button
        type="button"
        ref={triggerRef}
        aria-label="Features pillar map"
        aria-expanded={open}
        {...(open ? { "aria-controls": "features-dropdown" } : {})}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "rounded-(--radius) p-0.5 transition-colors duration-[var(--duration-fast)]",
          open ? "text-brand" : "text-text-2 hover:text-text",
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-3 transition-transform duration-[var(--duration-fast)] ease-standard motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id="features-dropdown"
          data-testid="features-dropdown"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          // pt-2 = the 8px visual gap carried as bridge padding, so the
          // pointer never crosses a dead zone between trigger and panel
          className="absolute left-0 top-full z-[var(--z-dropdown)] pt-2"
        >
          {/* shadow color: documented raw-color exception (effect/shadow
              colors, design.md §7) — Figma 98:1657 drop shadow */}
          <div className="flex gap-6 rounded-(--radius) border border-border bg-bg-elev p-5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            {[MARKETING_PILLARS.slice(0, 4), MARKETING_PILLARS.slice(4)].map(
              (column, ci) => (
                <ul key={ci} className="flex flex-col gap-2.5">
                  {column.map(({ pillar, icon: Icon, title, shortTitle }) => (
                    <li key={pillar}>
                      <a
                        href={`/#pillar-${pillar}`}
                        data-pillar={pillar}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:text-brand"
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                          style={{ color: pillarAccent(pillar) }}
                        />
                        {shortTitle ?? title}
                      </a>
                    </li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MarketingNav — nav-parity canon (SKILL.md 2026-07-19, revised same day):
 * logo · Features · Platform · Docs · GitHub star badge · ThemeToggle ·
 * Sign in text link · Try Cloud primary CTA (both → /signin). Features
 * additionally discloses the A1 pillar mini feature map on desktop
 * (FeaturesDropdown above — hover or chevron click; Escape closes).
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
        {/* landing v2 brand mark (135:2): filled bolt glyph + lowercase
            wordmark — the shared BrandMark construction */}
        <Link href="/" className="flex items-center">
          <BrandMark wordmark className="text-[16px]" />
        </Link>

        {NAV_LINKS.map((link) =>
          link.label === "GitHub" ? (
            <StarBadge
              key={link.label}
              starCount={starCount}
              className="hidden h-7 rounded-(--radius) border border-border px-2 text-[12px] hover:border-text-2 hover:text-text md:flex"
            />
          ) : link.label === "Features" ? (
            // A1: Features keeps its canonical /#features anchor and gains
            // the pillar-map dropdown disclosure (desktop only)
            <FeaturesDropdown key={link.label} href={link.href} />
          ) : (
            <a
              key={link.label}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
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
        <div
          id="marketing-menu"
          className="border-t border-border px-6 pt-2 pb-4 md:hidden"
        >
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
                {...(link.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
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
