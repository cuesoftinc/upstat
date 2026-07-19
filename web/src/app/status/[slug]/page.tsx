"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import { UptimeCard } from "@/components/ui/UptimeCard";
import { monitorPillStatus } from "@/controllers/monitors";
import { useStatusPageController } from "@/controllers/status";

/**
 * Public status page (Figma 132:3530) — StatusPageHeader banner, component
 * rows with 90-day strips, past-incident history. Reads live state, so a
 * declared incident reflects here immediately (pages.md B9 linkage).
 */
export default function StatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, loading, error } = useStatusPageController(slug);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-6 py-10">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 220 }} />
      </main>
    );
  }

  if (error || !page) {
    // branded 404 treatment (the app-wide not-found pattern) — public
    // surface, so the CTA points home, not into the auth-gated dashboard
    return (
      <main className="font-ui flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
        <p className="font-data text-[13px] text-text-2">404</p>
        <h1 className="text-[24px] font-semibold">Status page not found</h1>
        <p className="max-w-[420px] text-center text-[13px] leading-[1.45] text-text-2">
          No status page exists at this address — the owner may have renamed
          its slug or unpublished it.
        </p>
        <Link
          href="/"
          className="rounded-(--radius) bg-brand px-4 py-2 text-[13px] font-medium text-on-brand transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep"
        >
          Go to upstat.cuesoft.io
        </Link>
      </main>
    );
  }

  const first = page.components[0];

  return (
    <main data-testid="status-page" className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-[24px] font-semibold">
          <span
            aria-hidden="true"
            className="inline-flex size-7 items-center justify-center rounded-(--radius) bg-brand text-[14px] font-semibold text-on-brand"
          >
            U
          </span>
          {page.org_name.toLowerCase()} status
        </h1>
        {/* no subscribe affordance yet (pages.md B7 subscribe = Later) —
            the copy must not advertise one (dead-end copy, QA 2026-07-19) */}
        <p className="text-[13px] leading-[1.45] text-text-2">
          Live status for the {page.org_name.toLowerCase()} cloud — updates
          every 60s
        </p>
      </header>

      <StatusPageHeader
        overall={page.overall}
        lastUpdated={page.updated_at}
        updatedFormat="relative"
        updatedPlacement="banner"
      />

      <ul aria-label="Components" className="flex flex-col gap-2">
        {page.components.map((component) => (
          <li key={component.name}>
            <StatusPageComponentRow
              name={component.name}
              status={monitorPillStatus(component.status)}
              days={component.days}
              uptimePct={component.uptime_pct}
              layout="inline"
            />
          </li>
        ))}
      </ul>

      {first && (
        <section aria-label={`${first.name} 90 day history`} className="max-w-[420px]">
          <UptimeCard
            name={`${first.name} — 90 day history`}
            days={first.days}
            uptimePct={first.uptime_pct}
            p95Ms={first.p95_ms ?? undefined}
          />
        </section>
      )}

      <section aria-labelledby="past-incidents-heading" className="flex flex-col gap-2">
        <h2 id="past-incidents-heading" className="text-[16px] font-semibold">
          Past incidents
        </h2>
        {page.incidents.length === 0 ? (
          <p className="text-[13px] leading-[1.45] text-text-2">
            No incidents in the last 90 days.
          </p>
        ) : (
          page.incidents.map((incident) => (
            <IncidentHistoryEntry
              key={incident.key}
              title={`${incident.key} — ${incident.title}`}
              updates={incident.updates}
              variant="timeline"
            />
          ))
        )}
      </section>

      <footer className="border-t border-border pt-4 text-[12px] text-text-2">
        status.upstat.cuesoft.io/{page.slug} · powered by upstat
      </footer>
    </main>
  );
}
