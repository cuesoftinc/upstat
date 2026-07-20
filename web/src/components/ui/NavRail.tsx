"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Flame,
  Gauge,
  House,
  LayoutDashboard,
  Radio,
  ScrollText,
  Settings,
  Target,
  Zap,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/controllers/use-media-query";

export interface NavRailItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  /** layout=expanded — icon + inline label row, no flyout (design.md §2
   *  [Directive 2026-07-19] expandable rail). Default stays the 56px rail
   *  behavior, so existing call sites are untouched. */
  expanded?: boolean;
}

/**
 * NavRailItem — §8.2b: default / hover (flyout label) / active (brand
 * accent bar + brand icon, both layouts). `expanded` renders the 228px
 * icon+label row ([Directive 2026-07-19]); collapsed keeps the flyout.
 */
export function NavRailItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  expanded = false,
}: NavRailItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={clsx(
          "relative flex h-10 items-center rounded-(--radius)",
          expanded ? "w-full gap-3 px-2.5 text-left" : "size-10 justify-center",
          "transition-colors duration-[var(--duration-fast)] ease-standard",
          active
            ? "bg-brand/15 text-brand"
            : "text-text-2 hover:bg-bg-elev hover:text-text",
        )}
      >
        {/* active = brand accent bar + brand icon in both states (§2) */}
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand"
          />
        )}
        <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 2} />
        {expanded && (
          <span className="truncate text-[13px] font-medium">{label}</span>
        )}
      </button>
      {!expanded && hover && (
        <span
          role="tooltip"
          className={clsx(
            "font-ui absolute left-full top-1/2 z-[var(--z-overlay)] ml-2 -translate-y-1/2 whitespace-nowrap",
            "rounded-(--radius) border border-border bg-bg-elev px-2 py-1 text-[12px] text-text shadow-lg",
            "animate-[slide-in_var(--duration-fast)_var(--ease-standard)] motion-reduce:animate-none",
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** The pages.md Part B pillar order. */
export const NAV_PILLARS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "dashboards", label: "Dashboards", icon: LayoutDashboard },
  { key: "metrics", label: "Metrics", icon: Gauge },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "traces", label: "Traces", icon: Activity },
  { key: "rum", label: "RUM / Analytics", icon: BarChart3 },
  { key: "uptime", label: "Synthetics / Uptime", icon: Radio },
  { key: "monitors", label: "Monitors", icon: Bell },
  { key: "incidents", label: "Incidents", icon: Flame },
  { key: "slos", label: "SLOs", icon: Target },
  { key: "catalog", label: "Service Catalog", icon: BookOpen },
  { key: "settings", label: "Settings", icon: Settings },
];

/**
 * Pillar section groups (design.md §2 Telemetry / Respond / Platform,
 * [Directive 2026-07-19]) — B-order preserved; Home stays ungrouped at
 * the top of the rail.
 */
export const NAV_SECTIONS: { title: string | null; keys: string[] }[] = [
  { title: null, keys: ["home"] },
  {
    title: "Telemetry",
    keys: ["dashboards", "metrics", "logs", "traces", "rum", "uptime"],
  },
  { title: "Respond", keys: ["monitors", "incidents", "slos"] },
  { title: "Platform", keys: ["catalog", "settings"] },
];

/** design.md §2: the persisted expansion choice. */
const EXPANDED_STORAGE_KEY = "nav.rail.expanded";
/** Expanded is the default at ≥1280px; collapsed below (design.md §2). */
const EXPAND_DEFAULT_QUERY = "(min-width: 1280px)";

/**
 * Rail expansion state — persisted per user (localStorage), defaulting by
 * viewport. Resolved after mount: SSR renders collapsed, so hydration
 * stays deterministic.
 */
function useRailExpanded(): [boolean, () => void] {
  const [expanded, setExpanded] = useState(false);

  // Deferred a tick (use-request pattern): setState stays out of the
  // synchronous effect body.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
        if (stored !== null) {
          setExpanded(stored === "1");
          return;
        }
      } catch {
        /* storage unavailable (private mode) — fall through to viewport */
      }
      setExpanded(window.matchMedia(EXPAND_DEFAULT_QUERY).matches);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(EXPANDED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* non-persistent environments still toggle in-memory */
      }
      return next;
    });
  };

  return [expanded, toggle];
}

export interface NavRailProps {
  activeKey: string;
  onNavigate?: (key: string) => void;
  className?: string;
}

/** Rail brand mark + section groups + foot toggle (shared by the inline
 *  rail and the <md overlay drawer). */
function RailBody({
  expanded,
  activeKey,
  onSelect,
  footLabel,
  footExpanded,
  footTestId = "rail-toggle",
  onToggle,
}: {
  expanded: boolean;
  activeKey: string;
  onSelect: (key: string) => void;
  footLabel: string;
  footExpanded: boolean;
  footTestId?: string;
  onToggle: () => void;
}) {
  const byKey = new Map(NAV_PILLARS.map((p) => [p.key, p]));
  return (
    <>
      <span
        aria-hidden="true"
        className={clsx(
          "font-ui mb-2 flex h-8 items-center gap-2",
          expanded ? "px-1" : "justify-center",
        )}
      >
        {/* brand mark = the filled zap glyph (adjudicated 2026-07-20: the
            zap IS the brand across NavRail/signin/status/footer — the "U"
            tile was code drift; masters 284:2/285:2) */}
        <span className="flex size-8 shrink-0 items-center justify-center">
          <Zap
            aria-hidden="true"
            fill="currentColor"
            strokeWidth={0}
            className="size-6 text-brand"
          />
        </span>
        {expanded && (
          <span className="text-[14px] font-semibold text-text">upstat</span>
        )}
      </span>

      {NAV_SECTIONS.map((section) => (
        <div
          key={section.title ?? "top"}
          className={clsx(
            "flex flex-col gap-1",
            expanded ? "items-stretch" : "items-center",
          )}
        >
          {section.title ? (
            expanded ? (
              <span className="mt-3 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-2">
                {section.title}
              </span>
            ) : (
              // collapsed keeps the grouping legible as hairline breaks
              <span aria-hidden="true" className="my-1.5 h-px w-6 bg-border" />
            )
          ) : null}
          {section.keys.map((key) => {
            const pillar = byKey.get(key);
            if (!pillar) return null;
            return (
              <NavRailItem
                key={pillar.key}
                icon={pillar.icon}
                label={pillar.label}
                active={pillar.key === activeKey}
                expanded={expanded}
                onClick={() => onSelect(pillar.key)}
              />
            );
          })}
        </div>
      ))}

      <button
        type="button"
        data-testid={footTestId}
        aria-label={footLabel}
        aria-expanded={footExpanded}
        onClick={onToggle}
        className={clsx(
          "mt-auto flex h-9 items-center rounded-(--radius) text-text-2",
          "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev hover:text-text",
          expanded ? "w-full gap-3 px-2.5" : "size-9 justify-center",
        )}
      >
        {expanded ? (
          <>
            <ChevronsLeft aria-hidden="true" className="size-4.5 shrink-0" />
            <span className="truncate text-[12px]">Collapse</span>
          </>
        ) : (
          <ChevronsRight aria-hidden="true" className="size-4.5" />
        )}
      </button>
    </>
  );
}

/**
 * NavRail — product nav (design.md §2, [Directive 2026-07-19] expandable
 * rail supersedes flyout-only): collapsed 56px icon rail ⇄ expanded 240px
 * icon+label rows in Telemetry/Respond/Platform groups. Foot chevron
 * toggles; the choice persists (`nav.rail.expanded`); expanded is the
 * ≥1280px default.
 *
 * Below `md` ([Clarified 2026-07-19]) expansion must never squeeze the
 * content: the persisted state does not apply (mobile always boots the
 * 56px rail) and the foot chevron opens a 240px OVERLAY DRAWER over a
 * scrim instead — content keeps full width beneath; scrim tap, Escape,
 * and item selection close it; focus moves into the drawer and returns
 * to the toggle on close.
 */
export function NavRail({ activeKey, onNavigate, className }: NavRailProps) {
  const [expanded, toggleExpanded] = useRailExpanded();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // the inline rail never expands below md — the drawer takes over
  const inlineExpanded = expanded && !isMobile;
  const open = isMobile && drawerOpen;

  const select = (key: string) => {
    setDrawerOpen(false);
    onNavigate?.(key);
  };

  return (
    <>
      <nav
        aria-label="Product navigation"
        data-expanded={inlineExpanded}
        className={clsx(
          "sticky top-0 z-[var(--z-sticky)] flex h-dvh flex-col gap-1",
          "border-r border-border bg-bg py-2",
          "transition-[width] duration-[var(--duration-base)] ease-standard motion-reduce:transition-none",
          inlineExpanded ? "w-60 items-stretch px-1.5" : "w-14 items-center",
          className,
        )}
      >
        <RailBody
          expanded={inlineExpanded}
          activeKey={activeKey}
          onSelect={(key) => onNavigate?.(key)}
          footLabel={
            inlineExpanded ? "Collapse navigation" : "Expand navigation"
          }
          footExpanded={isMobile ? drawerOpen : inlineExpanded}
          onToggle={() => (isMobile ? setDrawerOpen(true) : toggleExpanded())}
        />
      </nav>

      {/* Radix Dialog (PR 168 review round 4): modal semantics give the
          drawer a real focus trap + inert background; Escape and
          overlay-tap dismissal and focus restoration to the toggle come
          with the primitive (the headless-behavior allowance, §1). */}
      <Dialog.Root
        open={open}
        onOpenChange={(next) => !next && setDrawerOpen(false)}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            data-testid="rail-scrim"
            className="fixed inset-0 z-[var(--z-overlay)] bg-bg/70 md:hidden"
          />
          <Dialog.Content
            aria-label="Product navigation drawer"
            aria-describedby={undefined}
            data-testid="rail-drawer"
            className={clsx(
              "fixed inset-y-0 left-0 z-[var(--z-modal)] flex w-60 flex-col gap-1 outline-none",
              "border-r border-border bg-bg px-1.5 py-2 shadow-xl md:hidden",
              "animate-[slide-in_var(--duration-entrance)_var(--ease-standard)] motion-reduce:animate-none",
            )}
          >
            <Dialog.Title className="sr-only">Product navigation</Dialog.Title>
            <RailBody
              expanded
              activeKey={activeKey}
              onSelect={select}
              footLabel="Close navigation"
              footTestId="rail-drawer-close"
              footExpanded
              onToggle={() => setDrawerOpen(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
