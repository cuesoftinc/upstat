"use client";

/**
 * Home sections — demo band (A4), use-case quads (A11), public status
 * embed (A6). Render-only; data from the home controller.
 */

import Link from "next/link";
import type { AlertRule, Series } from "@/models";
import { AlertRuleCard } from "@/components/ui/AlertRuleCard";
import {
  IncidentHistoryEntry,
  type IncidentHistoryUpdate,
} from "@/components/ui/IncidentHistoryEntry";
import { QueryValue } from "@/components/ui/QueryValue";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { UptimeCard } from "@/components/ui/UptimeCard";
import type { StatusRowDemo, UptimeDemo } from "@/controllers/home";
import { Section } from "./Section";

/* ------------------------------------------------------------------ */
/* A4 — demo band ("It looks like this — with your data.")              */
/* ------------------------------------------------------------------ */

export interface DemoBandSectionProps {
  series: Series[];
  query: string;
  heartbeat: UptimeDemo;
  availabilitySparkline: number[];
  latencySparkline: number[];
}

export function DemoBandSection({
  series,
  query,
  heartbeat,
  availabilitySparkline,
  latencySparkline,
}: DemoBandSectionProps) {
  return (
    <Section id="demo" title="It looks like this — with your data.">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <TimeseriesPanel
          title="p95 latency — api-common"
          titleAs="p"
          query={query}
          series={series}
          height={190}
          className="min-w-0"
        />
        <div className="min-w-0 flex flex-col gap-6">
          <UptimeCard
            name={heartbeat.name}
            days={heartbeat.days}
            uptimePct={heartbeat.uptimePct}
            p95Ms={heartbeat.p95Ms}
          />
          <div className="flex flex-wrap gap-6">
            <QueryValue
              label="availability · api-common"
              value="99.98%"
              deltaPct={0.01}
              threshold="ok"
              sparkline={availabilitySparkline}
            />
            <QueryValue
              label="p95 latency · api-common"
              value="142 ms"
              deltaPct={-8}
              threshold="ok"
              sparkline={latencySparkline}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A11 — use-case quads ("How teams actually use it.")                  */
/* ------------------------------------------------------------------ */

export interface UseCasesSectionProps {
  series: Series[];
  query: string;
  alertRule: AlertRule;
  incidentUpdate: IncidentHistoryUpdate;
  statusRow: StatusRowDemo;
  statusUpdatedAt: string;
  visitorsSparkline: number[];
  lcpSparkline: number[];
}

interface QuadCopy {
  title: string;
  body: string;
  readMoreHref: string;
}

function QuadCard({ title, body, readMoreHref }: QuadCopy) {
  return (
    <div className="min-w-0 flex flex-col gap-2">
      <div className="rounded-(--radius) border border-border bg-bg-elev p-5">
        <h3 className="text-[16px] font-semibold text-text">{title}</h3>
        <p className="mt-2 text-[13px] leading-[1.5] text-text-2">{body}</p>
      </div>
      <a
        href={readMoreHref}
        className="ml-5 text-[12px] font-medium text-brand transition-colors duration-[var(--duration-fast)] hover:text-brand-deep"
      >
        Read more →
      </a>
    </div>
  );
}

export function UseCasesSection({
  series,
  query,
  alertRule,
  incidentUpdate,
  statusRow,
  statusUpdatedAt,
  visitorsSparkline,
  lcpSparkline,
}: UseCasesSectionProps) {
  // id="features": the nav/footer Features links anchor here — the feature
  // highlights band; Platform keeps /#pillars (differentiated 2026-07-19,
  // the two previously shared one anchor)
  return (
    <Section id="features" title="How teams actually use it.">
      <div className="flex flex-col gap-16">
        {/* 1 — dashboards */}
        <div className="grid items-center gap-12 md:grid-cols-[1fr_480px]">
          <QuadCard
            title="Dashboards that stay in sync"
            body="11 widget types on one grid — timeseries, heatmaps, top lists, log streams, even markdown. Hover anywhere and every panel's crosshair lands on the same moment. Drag, resize, ship."
            readMoreHref="#demo"
          />
          <TimeseriesPanel
            title="p95 latency — api-common"
            titleAs="p"
            query={query}
            series={series}
            height={140}
            className="min-w-0"
          />
        </div>

        {/* 2 — alerting → incidents (visual left, copy right) */}
        <div className="grid items-center gap-12 md:grid-cols-[1fr_480px]">
          <div className="min-w-0 flex flex-col gap-4 md:order-1">
            <AlertRuleCard rule={alertRule} />
            <IncidentHistoryEntry
              updates={[incidentUpdate]}
              variant="timeline"
              className="border-b-0 py-0"
            />
          </div>
          <div className="md:order-2">
            <QuadCard
              title="From alert to postmortem"
              body="Monitors watch any signal: metric thresholds, log patterns, trace latency, uptime. A firing alert declares an incident with sev levels and a timeline — and SLO burn rates keep paging honest."
              readMoreHref="#status"
            />
          </div>
        </div>

        {/* 3 — status pages */}
        <div className="grid items-center gap-12 md:grid-cols-[1fr_480px]">
          <QuadCard
            title="Status pages people believe"
            body="Publish uptime and incident history to a page you control at your own slug. Subscribers get updates as your responders post them — the same timeline, no PR filter."
            readMoreHref="#status"
          />
          <div className="min-w-0 flex flex-col gap-3">
            <StatusPageHeader
              overall="operational"
              lastUpdated={statusUpdatedAt}
              updatedFormat="relative"
              updatedPlacement="banner"
            />
            <StatusPageComponentRow
              name={statusRow.name}
              status="ok"
              days={statusRow.days}
              uptimePct={statusRow.uptimePct}
              layout="inline"
            />
          </div>
        </div>

        {/* 4 — cookieless RUM (visual left, copy right) */}
        <div className="grid items-center gap-12 md:grid-cols-[1fr_480px]">
          <div className="min-w-0 flex flex-wrap gap-6 md:order-1">
            <QueryValue
              label="visitors · 24h"
              value="48.2k"
              deltaPct={6}
              sparkline={visitorsSparkline}
            />
            <QueryValue
              label="p75 LCP"
              value="2.4 s"
              deltaPct={18}
              threshold="warn"
              sparkline={lcpSparkline}
            />
          </div>
          <div className="md:order-2">
            <QuadCard
              title="Analytics without the banner"
              body="Cookieless RUM: no cookies, no raw IPs, a daily-rotating salt. Sessions, web vitals and JS errors — with a GDPR posture you don't have to explain away."
              readMoreHref="#faq"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A6 — public status embed ("We run on it. Publicly.")                 */
/* ------------------------------------------------------------------ */

export interface StatusEmbedSectionProps {
  rows: StatusRowDemo[];
  updatedAt: string;
}

export function StatusEmbedSection({
  rows,
  updatedAt,
}: StatusEmbedSectionProps) {
  return (
    <Section id="status" title="We run on it. Publicly.">
      {/* 135:471: banner + free-standing bordered rows — no outer card */}
      <div className="flex min-w-0 max-w-[800px] flex-col gap-4">
        <StatusPageHeader
          overall="operational"
          lastUpdated={updatedAt}
          updatedFormat="relative"
          updatedPlacement="banner"
        />
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <StatusPageComponentRow
              key={row.name}
              name={row.name}
              status="ok"
              days={row.days}
              uptimePct={row.uptimePct}
              layout="inline"
            />
          ))}
        </div>
      </div>
      {/* the REAL status page is the in-app B7 route — the imagined
          status.upstat.cuesoft.io host was a dead link (sweep 2026-07-19) */}
      <Link
        href="/status/upstat"
        className="mt-4 inline-block font-data text-[12px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
      >
        /status/upstat — our own public status page
      </Link>
    </Section>
  );
}
