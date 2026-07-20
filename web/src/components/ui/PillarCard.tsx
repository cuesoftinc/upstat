"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  Globe,
  LayoutGrid,
  Route,
  Target,
} from "lucide-react";

export interface PillarCardProps {
  /** Pillar index 1..8 — drives the accent color (series palette). */
  pillar: number;
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  /** Anchor id — the A1 pillar dropdown deep-links `/#pillar-n` here. */
  id?: string;
  /** Compact variant for the MarketingNav pillar dropdown (A1). */
  compact?: boolean;
  className?: string;
}

/** Pillar accent — series-palette color by pillar index (shared with the
 *  A1 nav dropdown, which reuses this construction per pages.md A1). */
export function pillarAccent(pillar: number): string {
  return `var(--color-series-${((pillar - 1) % 8) + 1})`;
}

/**
 * The pages.md A3 pillar set (8) — copy + icons per the landing v2 masters
 * (Figma 91:1517 instances on frame 135:2, W2 QA loop). `shortTitle` is the
 * compact label the A1 Features dropdown renders (Figma 98:1709).
 */
export const MARKETING_PILLARS: (Omit<
  PillarCardProps,
  "compact" | "className"
> & { shortTitle?: string })[] = [
  {
    pillar: 1,
    icon: Activity,
    title: "Uptime & Synthetics",
    description: "Catch downtime before your users do",
  },
  {
    pillar: 2,
    icon: Globe,
    title: "Website Analytics / RUM",
    shortTitle: "Analytics / RUM",
    description: "Real-user vitals & errors, cookieless",
  },
  {
    pillar: 3,
    icon: BarChart3,
    title: "Metrics",
    description: "Explore any metric in one grammar",
  },
  {
    pillar: 4,
    icon: FileText,
    title: "Logs",
    description: "Live-tail production in seconds",
  },
  {
    pillar: 5,
    icon: Route,
    title: "APM / Traces",
    description: "See where every slow request went",
  },
  {
    pillar: 6,
    icon: LayoutGrid,
    title: "Dashboards",
    description: "Every signal, one synced grid",
  },
  {
    pillar: 7,
    icon: Bell,
    title: "Alerting",
    description: "Page on any signal, not just pings",
  },
  {
    pillar: 8,
    icon: Target,
    title: "Incidents & SLOs",
    description: "Sev workflow, honest error budgets",
  },
];

/**
 * PillarCard — §8.2b: pillar ×8 (icon + color accent) · default/hover (lift).
 * Master 91:1517 (landing v2 state): accent dash (24×3) above a 24px icon,
 * 16/semibold title, 12/text-2 benefit line.
 */
export function PillarCard({
  pillar,
  icon: Icon,
  title,
  description,
  href = "#",
  id,
  compact = false,
  className,
}: PillarCardProps) {
  const accent = pillarAccent(pillar);
  return (
    <a
      href={href}
      id={id}
      data-pillar={pillar}
      // scroll-mt clears the sticky marketing nav when anchor-targeted
      className={clsx(
        "scroll-mt-20",
        "font-ui group flex flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev",
        compact ? "p-3" : "p-4",
        "transition-[transform,border-color] duration-[var(--duration-base)] ease-standard",
        "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        className,
      )}
      style={{ ["--pillar-accent" as string]: accent }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "";
      }}
    >
      {/* accent dash — master 91:1517 */}
      <span
        aria-hidden="true"
        className="h-[3px] w-6 rounded-full"
        style={{ background: accent }}
      />
      <Icon
        aria-hidden="true"
        className={compact ? "size-5" : "size-6"}
        style={{ color: accent }}
      />
      <span
        className={clsx(
          "font-semibold text-text",
          compact ? "text-[13px]" : "text-[16px]",
        )}
      >
        {title}
      </span>
      {!compact && (
        <span className="text-[12px] leading-[1.45] text-text-2">
          {description}
        </span>
      )}
    </a>
  );
}
