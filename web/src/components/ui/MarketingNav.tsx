"use client";

import { clsx } from "clsx";
import { ChevronDown, Star, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { MARKETING_PILLARS, PillarCard } from "./PillarCard";

export interface MarketingNavProps {
  onSignIn?: () => void;
  onTryCloud?: () => void;
  /** Live GitHub star count — populated at runtime, never a static number (A13). */
  starCount?: number | null;
  className?: string;
}

/**
 * MarketingNav — pages.md A1: logo · Platform (pillar dropdown = mini
 * feature map ×8) · Docs · Community · GitHub badge · Sign in · Try Cloud.
 * Star badge is neutral ("Star") unless a runtime count arrives (§8.2b).
 *
 * The bar (border/background) is full-bleed, but the ROW sits on the
 * marketing container (design.md §2, decided 2026-07-19: 1152px content at
 * 1440, rails x144/x1296) — the Figma master spans the container, it is not
 * pinned to the viewport edges. Without the cap, nav items hugged the
 * viewport on ultra-wide screens while every section stayed centered.
 */
export function MarketingNav({
  onSignIn,
  onTryCloud,
  starCount = null,
  className,
}: MarketingNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
        <a
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
        </a>

        <div
          className="relative hidden md:block"
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <button
            type="button"
            aria-expanded={dropdownOpen}
            // Open-only: hover already opened it — a toggle would close on the
            // very click that follows the hover. Escape / mouse-leave close.
            onClick={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDropdownOpen(false);
            }}
            className="flex items-center gap-1 rounded-(--radius) px-2 py-1.5 text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Platform
            <ChevronDown
              aria-hidden="true"
              className={clsx(
                "size-3.5 transition-transform duration-[var(--duration-fast)]",
                dropdownOpen && "rotate-180",
              )}
            />
          </button>
          {dropdownOpen && (
            <div
              role="menu"
              aria-label="Platform pillars"
              className="absolute left-0 top-full z-[var(--z-dropdown)] grid w-[560px] grid-cols-2 gap-2 rounded-(--radius) border border-border bg-bg-elev p-3 shadow-xl"
            >
              {MARKETING_PILLARS.map((pillar) => (
                <PillarCard key={pillar.pillar} {...pillar} compact />
              ))}
            </div>
          )}
        </div>

        <a
          href="https://docs.upstat.cuesoft.io"
          className="hidden text-[13px] font-medium text-text-2 hover:text-text md:block"
        >
          Docs
        </a>
        <a
          href="#community"
          className="hidden text-[13px] font-medium text-text-2 hover:text-text md:block"
        >
          Community
        </a>

        <div className="flex-1" />

        <a
          href="https://github.com/cuesoftinc/upstat"
          target="_blank"
          rel="noreferrer"
          className="flex h-7 items-center gap-1.5 rounded-(--radius) border border-border px-2 text-[12px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:border-text-2 hover:text-text"
        >
          <Star aria-hidden="true" className="size-3.5" />
          Star
          {typeof starCount === "number" && (
            <span className="tabular-nums text-text">
              {starCount.toLocaleString()}
            </span>
          )}
        </a>

        <button
          type="button"
          onClick={onSignIn}
          className="text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
        >
          Sign in
        </button>
        <Button kind="brand" onClick={onTryCloud}>
          Try Cloud
        </Button>
      </div>
    </nav>
  );
}
