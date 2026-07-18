"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Flame,
  Gauge,
  LayoutDashboard,
  Radio,
  ScrollText,
} from "lucide-react";

export interface PillarCardProps {
  /** Pillar index 1..8 — drives the accent color (series palette). */
  pillar: number;
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  /** Compact variant for the MarketingNav pillar dropdown (A1). */
  compact?: boolean;
  className?: string;
}

/** The pages.md A3 pillar set (8). */
export const MARKETING_PILLARS: Omit<PillarCardProps, "compact" | "className">[] = [
  { pillar: 1, icon: Radio, title: "Uptime & Synthetics", description: "HTTP checks, status pages, and the classic 90-day strip." },
  { pillar: 2, icon: BarChart3, title: "Website Analytics / RUM", description: "Cookieless visitors, web vitals, and JS error tracking." },
  { pillar: 3, icon: Gauge, title: "Metrics", description: "OTLP + StatsD ingestion with a fast explorer." },
  { pillar: 4, icon: ScrollText, title: "Logs", description: "Live tail, facets, and the ⌘click pivot." },
  { pillar: 5, icon: Activity, title: "APM / Traces", description: "Waterfalls, service pages, and the service map." },
  { pillar: 6, icon: LayoutDashboard, title: "Dashboards", description: "Composable grids with portable JSON." },
  { pillar: 7, icon: Bell, title: "Alerting", description: "Monitors on any signal with honest thresholds." },
  { pillar: 8, icon: Flame, title: "Incidents & SLOs", description: "Sev levels, timelines, and burn-rate math." },
];

/** PillarCard — §8.2b: pillar ×8 (icon + color accent) · default/hover (lift). */
export function PillarCard({
  pillar,
  icon: Icon,
  title,
  description,
  href = "#",
  compact = false,
  className,
}: PillarCardProps) {
  const accent = `var(--color-series-${((pillar - 1) % 8) + 1})`;
  return (
    <a
      href={href}
      data-pillar={pillar}
      className={clsx(
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
      <Icon aria-hidden="true" className="size-5" style={{ color: accent }} />
      <span className={clsx("font-semibold text-text", compact ? "text-[13px]" : "text-[16px]")}>
        {title}
      </span>
      {!compact && (
        <span className="text-[13px] leading-[1.45] text-text-2">{description}</span>
      )}
    </a>
  );
}
