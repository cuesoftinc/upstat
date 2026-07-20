"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { UptimeCard } from "@/components/ui/UptimeCard";
import {
  monitorPillStatus,
  useMonitorsController,
  useUptimeCardsController,
} from "@/controllers/monitors";
import { useSyntheticsController } from "@/controllers/synthetics";
import { ageLabel } from "@/controllers/shell";

/**
 * B7 Synthetics & Uptime (Figma 130:2120) — UptimeCards + the check list
 * (MonitorRow states ×6, mute toggles) + the multi-step/browser Synthetic
 * checks section (OBS-011); "New check" opens the B7 builder.
 */
export default function UptimePage() {
  const router = useRouter();
  const ctrl = useMonitorsController();
  const cards = useUptimeCardsController(ctrl.data);
  const synthetics = useSyntheticsController();

  const monitorsById = new Map((ctrl.data ?? []).map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-6 px-6 py-5" data-testid="uptime-page">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Synthetics &amp; Uptime</h1>
        <Button
          onClick={() => router.push("/dashboard/uptime/new")}
          data-testid="new-check"
        >
          New check
        </Button>
      </header>

      {/* UptimeCard strips */}
      <section
        aria-label="Uptime overview"
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        {cards.loading || ctrl.loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} kind="panel-axis" style={{ height: 96 }} />
          ))
        ) : (cards.data ?? []).length === 0 ? (
          <p className="text-[13px] text-text-2">
            No checks yet — create your first below.
          </p>
        ) : (
          (cards.data ?? []).map((history) => {
            const monitor = monitorsById.get(history.monitor_id);
            if (!monitor) return null;
            return (
              <UptimeCard
                key={history.monitor_id}
                name={monitor.name}
                days={history.days}
                uptimePct={history.uptime_90d_pct}
                p95Ms={monitor.last_response_time_ms ?? undefined}
                status={monitorPillStatus(monitor.status)}
              />
            );
          })
        )}
      </section>

      {/* B7 multi-step / browser checks (OBS-011, Figma 329:12262) */}
      <section aria-labelledby="synthetics-heading">
        <h2 id="synthetics-heading" className="mb-3 text-[16px] font-semibold">
          Synthetic checks
        </h2>
        {synthetics.loading ? (
          <Skeleton kind="line" />
        ) : (synthetics.data ?? []).length === 0 ? (
          <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2">
            No multi-step or browser checks yet — New check → Multi-step.
          </p>
        ) : (
          <ul aria-label="Synthetic checks">
            {(synthetics.data ?? []).map((check) => (
              <li key={check.id} data-testid={`synthetic-${check.id}`}>
                <Link
                  href={`/dashboard/uptime/checks/${check.id}`}
                  className="flex h-10 items-center gap-3 border-b border-border px-3 transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev"
                >
                  <StatusPill
                    status={
                      check.last_run_status === null
                        ? "pending"
                        : check.last_run_status === "pass"
                          ? "ok"
                          : "crit"
                    }
                    dotOnly
                  />
                  <span className="w-64 truncate text-[13px] font-medium text-text">
                    {check.name}
                  </span>
                  <span className="font-data rounded-(--radius) border border-border px-1.5 py-0.5 text-[10px] tracking-wide text-text-2">
                    {check.kind === "browser" ? "BROWSER" : "MULTI-STEP"}
                  </span>
                  <span className="font-data min-w-0 flex-1 truncate text-[12px] text-text-2">
                    {check.steps.length} step
                    {check.steps.length === 1 ? "" : "s"}
                    {check.browser ? " · headless browser" : ""}
                  </span>
                  <span className="font-data text-[12px] text-text-2">
                    {check.last_run_at
                      ? `ran ${ageLabel(check.last_run_at)} ago`
                      : "never run"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="mb-3 text-[16px] font-semibold">
          Uptime checks
        </h2>
        {ctrl.loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} kind="line" />
            ))}
          </div>
        ) : (ctrl.data ?? []).length === 0 ? (
          <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2">
            Create your first check — Monitors → New monitor.
          </p>
        ) : (
          <ul aria-label="Uptime checks">
            {(ctrl.data ?? []).map((m) => (
              <li key={m.id} data-testid={`monitor-${m.id}`}>
                <MonitorRow
                  status={monitorPillStatus(m.status)}
                  name={m.name}
                  summary={`uptime(check:${m.name.toLowerCase().replace(/\s+/g, "-")}) — ${m.target}`}
                  lastTriggered={
                    m.status === "pending"
                      ? "awaiting first check"
                      : m.muted
                        ? "muted"
                        : m.last_checked_at
                          ? `${ageLabel(m.last_checked_at)} ago`
                          : undefined
                  }
                  muted={m.muted}
                  onMutedChange={(muted) => void ctrl.setMuted(m.id, muted)}
                  onClick={() => router.push(`/dashboard/uptime/${m.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
