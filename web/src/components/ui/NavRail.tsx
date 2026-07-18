"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Flame,
  Gauge,
  House,
  LayoutDashboard,
  Radio,
  ScrollText,
  Settings,
  Target,
} from "lucide-react";
import { useState } from "react";

export interface NavRailItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}

/** NavRailItem — §8.2b: default / hover (flyout label) / active (brand accent). */
export function NavRailItem({ icon: Icon, label, active = false, onClick }: NavRailItemProps) {
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
          "flex size-10 items-center justify-center rounded-(--radius)",
          "transition-colors duration-[var(--duration-fast)] ease-standard",
          active
            ? "bg-brand/15 text-brand"
            : "text-text-2 hover:bg-bg-elev hover:text-text",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.2 : 2} />
      </button>
      {hover && (
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

export interface NavRailProps {
  activeKey: string;
  onNavigate?: (key: string) => void;
  className?: string;
}

/** NavRail — 56px icon rail with flyout labels (§2 layout; §8.2b chrome). */
export function NavRail({ activeKey, onNavigate, className }: NavRailProps) {
  return (
    <nav
      aria-label="Product navigation"
      className={clsx(
        "sticky top-0 z-[var(--z-sticky)] flex h-screen w-14 flex-col items-center gap-1",
        "border-r border-border bg-bg py-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="font-ui mb-2 flex size-8 items-center justify-center rounded-(--radius) bg-brand text-[14px] font-semibold text-on-brand"
      >
        U
      </span>
      {NAV_PILLARS.map((pillar) => (
        <NavRailItem
          key={pillar.key}
          icon={pillar.icon}
          label={pillar.label}
          active={pillar.key === activeKey}
          onClick={() => onNavigate?.(pillar.key)}
        />
      ))}
    </nav>
  );
}
