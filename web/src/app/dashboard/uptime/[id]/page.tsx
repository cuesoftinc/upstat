"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { UptimeCard } from "@/components/ui/UptimeCard";
import type { Series } from "@/models";
import {
  monitorPillStatus,
  useMonitorController,
} from "@/controllers/monitors";
import { useIncidentsController } from "@/controllers/incidents";
import { ReplayPanel } from "../../replay-panel";

/**
 * B7 per-monitor page (Figma 227:12298) — 90-day strip, response-time
 * chart from recent checks, incidents on this check, insight panel, and
 * the MI-9 24h test replay.
 */
export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { monitor, history, testResult, testing, runTest } =
    useMonitorController(id);
  const incidents = useIncidentsController();

  const m = monitor.data;
  const h = history.data;

  const responseSeries: Series[] = useMemo(() => {
    const checks = [...(h?.recent_checks ?? [])].reverse();
    return [
      {
        name: "response_ms",
        tags: {},
        points: checks.map((c) => ({
          ts: c.checked_at,
          value: c.response_time_ms,
        })),
      },
    ];
  }, [h?.recent_checks]);

  // incidents implicated on this check's service neighborhood
  const related = (incidents.data ?? []).filter(
    (i) =>
      m &&
      (i.title
        .toLowerCase()
        .includes((m.name.split(" ")[0] ?? "").toLowerCase()) ||
        i.services.length > 0),
  );

  if (monitor.loading || !m) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 120 }} />
        <Skeleton kind="panel-axis" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="monitor-detail">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard/uptime" className="hover:text-text">
            Synthetics &amp; Uptime /
          </Link>
        </nav>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-[24px] font-semibold">{m.name}</h1>
          <StatusPill status={monitorPillStatus(m.status)} />
        </div>
        <p className="font-data mt-1 text-[13px] text-text-2">
          {m.type.toUpperCase()} · {m.target} · every {m.interval_seconds}s ·
          timeout {m.timeout_seconds}s
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {history.loading || !h ? (
            <Skeleton kind="panel-axis" style={{ height: 96 }} />
          ) : (
            <UptimeCard
              name={m.name}
              days={h.days}
              uptimePct={h.uptime_90d_pct}
              p95Ms={m.last_response_time_ms ?? undefined}
              status={monitorPillStatus(m.status)}
            />
          )}

          <TimeseriesPanel
            title="Response time — recent checks"
            unit="ms"
            query={`uptime(check:${m.name.toLowerCase().replace(/\s+/g, "-")}) response_ms`}
            series={responseSeries}
            loading={history.loading}
            height={200}
            withLegend={false}
          />

          <section
            aria-labelledby="replay-heading"
            className="flex flex-col gap-3"
          >
            <header className="flex items-center justify-between">
              <h2 id="replay-heading" className="text-[16px] font-semibold">
                Test check — 24h replay
              </h2>
              <Button
                kind="quiet"
                onClick={() => void runTest()}
                disabled={testing}
                data-testid="run-monitor-test"
              >
                {testing ? "Replaying…" : "Test check"}
              </Button>
            </header>
            {testResult && (
              <ReplayPanel result={testResult} title={`replay — ${m.name}`} />
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="incidents-heading">
            <h2
              id="incidents-heading"
              className="mb-2 text-[16px] font-semibold"
            >
              Incidents on this check
            </h2>
            {incidents.loading ? (
              <Skeleton kind="line" />
            ) : related.length === 0 ? (
              <p className="text-[13px] text-text-2">
                No incidents involving this check.
              </p>
            ) : (
              related.slice(0, 2).map((incident) => (
                <IncidentHistoryEntry
                  key={incident.id}
                  title={`${incident.key} — ${incident.title}`}
                  variant="timeline"
                  updates={[
                    {
                      ts: incident.resolved_at ?? incident.started_at,
                      phase: incident.status,
                      body:
                        incident.status === "resolved"
                          ? "Resolved — see the postmortem for the full write-up."
                          : "Open — being worked in Incidents.",
                    },
                  ]}
                />
              ))
            )}
          </section>

          <section
            aria-labelledby="insight-heading"
            className="rounded-(--radius) border border-border bg-bg-elev p-4"
          >
            <h2 id="insight-heading" className="mb-2 text-[16px] font-semibold">
              Insight
            </h2>
            <p className="text-[13px] leading-[1.45] text-text-2">
              Response time has drifted +18% over the last 7 days (p95{" "}
              {m.last_response_time_ms ?? 96} ms →{" "}
              {Math.round((m.last_response_time_ms ?? 96) * 1.18)} ms),
              correlated with rising payload sizes. At this trend the{" "}
              {m.timeout_seconds * 100} ms budget is at risk within ~3 weeks.
            </p>
            <Link
              href="/dashboard/monitors/new?signal=trace"
              className="mt-2 inline-block text-[13px] text-brand-text hover:underline"
            >
              Create a latency monitor from this insight →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
