"use client";

/**
 * Home sections — hero (A2), pillar grid (A3), OTel ingestion (A5),
 * how-it-works (A12). Render-only; data arrives from the home controller.
 */

import type { ApiKey, Series } from "@/models";
import { APIKeyRow } from "@/components/ui/APIKeyRow";
import { Button } from "@/components/ui/Button";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { DeferredPanel } from "@/components/ui/DeferredPanel";
import { MARKETING_PILLARS, PillarCard } from "@/components/ui/PillarCard";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { UptimeCard } from "@/components/ui/UptimeCard";
import type { UptimeDemo } from "@/controllers/home";
import { OTEL_SNIPPETS } from "./content";
import { Section } from "./Section";

/* ------------------------------------------------------------------ */
/* A2 — Hero                                                            */
/* ------------------------------------------------------------------ */

export interface HeroSectionProps {
  series: Series[];
  query: string;
  heartbeat: UptimeDemo;
  cursor: number | null;
  onTryCloud: () => void;
  onSelfHost: () => void;
}

export function HeroSection({
  series,
  query,
  heartbeat,
  cursor,
  onTryCloud,
  onSelfHost,
}: HeroSectionProps) {
  return (
    <Section className="pt-16">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <div className="min-w-0 flex flex-col gap-6 pt-2">
          <h1 className="font-ui text-[34px] font-semibold leading-[1.2] text-text md:text-[44px]">
            All your telemetry.
            <br />
            One open platform.
          </h1>
          <p className="max-w-[560px] text-[14px] leading-normal text-text-2">
            Uptime, RUM, metrics, logs, traces, dashboards, alerts, SLOs and
            status pages — one open-source platform, OTel-native and
            ClickHouse-fast.
          </p>
          <div className="flex items-center gap-3">
            <Button kind="brand" onClick={onTryCloud}>
              Try Cloud
            </Button>
            <Button kind="quiet" onClick={onSelfHost}>
              Self Host
            </Button>
          </div>
          <p className="text-[12px] text-text-2">
            Open-source · OTLP in, answers out · Self-host in one line
          </p>
        </div>

        <div className="min-w-0 flex flex-col gap-5">
          <TimeseriesPanel
            title="p95 latency — api-common"
            titleAs="p"
            unit="ms"
            query={query}
            series={series}
            height={190}
            cursor={cursor}
          />
          <UptimeCard
            name={heartbeat.name}
            days={heartbeat.days}
            uptimePct={heartbeat.uptimePct}
            p95Ms={heartbeat.p95Ms}
          />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A3 — Pillar grid                                                     */
/* ------------------------------------------------------------------ */

export function PillarsSection() {
  return (
    <Section id="pillars" title="Eight pillars. One query grammar.">
      {/* canon (design.md §2): 270px cards / 24px gaps on the 1152 container
          (cols x144/438/732/1026 at 1440) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETING_PILLARS.map((pillar) => (
          // id: the A1 nav pillar dropdown deep-links each card (/#pillar-n)
          <PillarCard
            key={pillar.pillar}
            {...pillar}
            id={`pillar-${pillar.pillar}`}
          />
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A5 — OTel ingestion                                                  */
/* ------------------------------------------------------------------ */

function FlowChip({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={
        accent
          ? "rounded-(--radius) border border-brand px-3.5 py-2 font-data text-[12px] text-brand-text"
          : "rounded-(--radius) border border-border px-3.5 py-2 font-data text-[12px] text-text"
      }
    >
      {label}
    </span>
  );
}

export function OtelSection() {
  return (
    <Section
      title="Point your OpenTelemetry SDK at us. Done."
      sub="Point your existing OTel SDKs at one endpoint — gRPC 4317 / HTTP 4318. Nothing proprietary in your code."
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_480px]">
        {/* below-the-fold demo visuals mount on approach (TBT); reserves
            are the rendered desktop sizes — see DeferredPanel */}
        <DeferredPanel minHeight={176}>
          <CodeSnippet tabs={OTEL_SNIPPETS} />
        </DeferredPanel>
        <div className="flex flex-col gap-5">
          <div
            className="flex flex-wrap items-center gap-3"
            aria-label="Ingest flow"
          >
            <FlowChip label="your services" />
            <span aria-hidden="true" className="text-[13px] text-text-2">
              ⟶
            </span>
            <FlowChip label="OTel SDK / collector" />
            <span aria-hidden="true" className="text-[13px] text-text-2">
              ⟶
            </span>
            <FlowChip label="upstat ingest + storage" accent />
          </div>
          <p className="text-[12px] text-text-2">
            OTLP (traces · metrics · logs) + StatsD-compatible endpoint ·
            browser SDK for RUM
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A12 — How it works (3 steps, real component thumbnails)              */
/* ------------------------------------------------------------------ */

const DEMO_KEY: ApiKey = {
  id: "key_home_demo",
  kind: "ingestion_token",
  name: "prod ingest — api-common",
  scope: "otlp",
  key_masked: "up_live_9f2c…3d1a",
  status: "active",
  created_at: "2026-07-01T09:00:00Z",
  rejected_count: 0,
};

export interface HowItWorksSectionProps {
  series: Series[];
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <span className="font-data text-[20px] font-semibold tabular-nums text-brand-text">
          {n}
        </span>
        <h3 className="text-[16px] font-semibold text-text">{title}</h3>
      </div>
      <p className="text-[12px] leading-normal text-text-2">{body}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function HowItWorksSection({ series }: HowItWorksSectionProps) {
  return (
    <Section title="How it works">
      {/* canon (design.md §2): 3×368px cols / 24px gaps on the 1152 container */}
      <div className="grid gap-6 md:grid-cols-3">
        <Step
          n={1}
          title="Point your SDK at us"
          body="One endpoint — gRPC 4317 / HTTP 4318. No agents to babysit."
        >
          <DeferredPanel minHeight={176}>
            <CodeSnippet tabs={OTEL_SNIPPETS} />
          </DeferredPanel>
        </Step>
        <Step
          n={2}
          title="Send your first data"
          body="Scoped ingestion tokens — rotate with zero downtime."
        >
          {/* the key row keeps its natural width; scrolls inside at 375w */}
          <DeferredPanel minHeight={48} className="overflow-x-auto">
            <APIKeyRow apiKey={DEMO_KEY} />
          </DeferredPanel>
        </Step>
        <Step
          n={3}
          title="See everything"
          body="Dashboards, traces, logs and alerts light up as data lands."
        >
          <DeferredPanel minHeight={220}>
            <TimeseriesPanel
              title="p95 latency — api-common"
              titleAs="p"
              unit="ms"
              series={series}
              height={130}
            />
          </DeferredPanel>
        </Step>
      </div>
    </Section>
  );
}
