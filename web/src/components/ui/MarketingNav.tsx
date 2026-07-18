"use client";

import { clsx } from "clsx";
import { ChevronDown, Star } from "lucide-react";
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
 */
export function MarketingNav({ onSignIn, onTryCloud, starCount = null, className }: MarketingNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav
      aria-label="Marketing"
      className={clsx(
        "font-ui sticky top-0 z-[var(--z-sticky)] flex h-14 items-center gap-4 border-b border-border bg-bg px-6",
        className,
      )}
    >
      <a href="/" className="flex items-center gap-2 text-[16px] font-semibold text-text">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-(--radius) bg-brand text-[12px] font-semibold text-on-brand"
        >
          U
        </span>
        Upstat
      </a>

      <div
        className="relative"
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

      <a href="https://docs.upstat.cuesoft.io" className="text-[13px] font-medium text-text-2 hover:text-text">
        Docs
      </a>
      <a href="#community" className="text-[13px] font-medium text-text-2 hover:text-text">
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
          <span className="tabular-nums text-text">{starCount.toLocaleString()}</span>
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
    </nav>
  );
}
