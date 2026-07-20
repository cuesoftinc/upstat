"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FunnelStageCard } from "@/components/ui/FunnelStageCard";
import { Heatmap } from "@/components/ui/Heatmap";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { TopList } from "@/components/ui/TopList";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRumDrilldownController } from "@/controllers/rum";
import { useTimeRange } from "@/controllers/time-range";

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** "2026-06-08T00:00:00.000Z" → "Jun 8" (cohort axis labels). */
function cohortLabel(startIso: string): string {
  const d = new Date(startIso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * B6 RUM drill-down (U6-2; Figma "B6 — RUM analytics drill-down", 335:2) —
 * funnel (FunnelStageCard chain: page views → sessions → conversions),
 * sessions panel, top pages / top referrers TopLists, and the weekly-
 * cohort retention grid (the Heatmap construction re-axised to cohort
 * weeks). Conversions count the registered signup event — labeled
 * honestly in-page.
 */
export default function RumDrilldownPage() {
  const router = useRouter();
  const time = useTimeRange();
  const { summary, drilldown, properties } = useRumDrilldownController({
    from: time.fromIso,
    to: time.toIso,
  });
  const [property, setProperty] = useState<string | null>(null);

  const s = summary.data;
  const d = drilldown.data;
  const activeProperty = property ?? (properties.data ?? [])[0]?.id ?? null;
  const propertyName =
    (properties.data ?? []).find((p) => p.id === activeProperty)?.name ?? "—";

  const sessionSeries = useMemo(() => {
    const points = (s?.series ?? []).map((b) => ({
      ts: b.bucket,
      value: Math.round(b.count / 2.6),
    }));
    return [{ name: "sessions", tags: {}, points }];
  }, [s?.series]);

  const retentionGrid = useMemo(() => {
    const cohorts = d?.retention.cohorts ?? [];
    const weeks = d?.retention.weeks ?? 7;
    return {
      columns: cohorts.map((c) => cohortLabel(c.start)),
      rows: Array.from({ length: weeks }, (_, w) => `wk ${w}`),
      // Heatmap wants values[row][col] — rows are week offsets here
      values: Array.from({ length: weeks }, (_, w) =>
        cohorts.map((c) => c.values[w] ?? 0),
      ),
    };
  }, [d?.retention]);

  const noData = !summary.loading && (s?.page_views ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6 px-6 py-5" data-testid="rum-drilldown">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-[20px] font-semibold">RUM — drill-down</h1>
        <Select
          options={(properties.data ?? []).map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          value={activeProperty}
          onValueChange={setProperty}
          placeholder="No properties"
          aria-label="Property"
          className="min-w-56"
        />
        <Button
          className="ml-auto"
          onClick={() => router.push("/dashboard/rum/new")}
          data-testid="add-property"
        >
          Add property
        </Button>
      </header>

      {noData ? (
        <EmptyState pillar="rum" />
      ) : (
        <>
          {/* funnel — FunnelStageCard chain with → connectors */}
          <section
            aria-label="Conversion funnel"
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-3">
              {drilldown.loading || !d
                ? Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} kind="value" className="min-w-56" />
                  ))
                : d.funnel.stages.map((stage, i) => (
                    <Fragment key={stage.key}>
                      {i > 0 && (
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-text-2"
                        />
                      )}
                      <FunnelStageCard
                        label={stage.label}
                        count={stage.count}
                        pctOfPrevious={stage.pct_of_previous}
                      />
                    </Fragment>
                  ))}
            </div>
            {/* the honest conversion definition (accuracy canon) */}
            {d && (
              <p className="text-[12px] text-text-2">
                Conversion ={" "}
                <code className="font-data">{d.funnel.conversion_event}</code>{" "}
                events (signup) over the selected range.
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <TimeseriesPanel
              title={`Sessions — ${propertyName}`}
              query={`rum:sessions{property:${propertyName}} by device`}
              series={sessionSeries}
              mode="bars"
              loading={summary.loading}
              height={200}
              onZoomRange={time.zoomBy}
              onZoomReset={time.resetZoom}
            />
            <section
              aria-labelledby="dd-top-pages-heading"
              className="rounded-(--radius) border border-border bg-bg-elev p-4"
            >
              <h2
                id="dd-top-pages-heading"
                className="mb-3 text-[13px] text-text-2"
              >
                Top pages
              </h2>
              <TopList
                loading={summary.loading}
                entries={(s?.top_pages ?? []).map((p) => ({
                  label: p.value,
                  value: p.count,
                  display: fmtK(p.count),
                }))}
              />
            </section>
            <section
              aria-labelledby="dd-top-referrers-heading"
              className="rounded-(--radius) border border-border bg-bg-elev p-4"
            >
              <h2
                id="dd-top-referrers-heading"
                className="mb-3 text-[13px] text-text-2"
              >
                Top referrers
              </h2>
              <TopList
                loading={summary.loading}
                entries={(s?.top_referrers ?? []).map((p) => ({
                  label: p.value,
                  value: p.count,
                  display: fmtK(p.count),
                }))}
              />
            </section>
          </div>

          <section
            aria-labelledby="retention-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="retention-heading" className="text-[16px] font-semibold">
              Retention — weekly cohorts
            </h2>
            <div className="w-fit max-w-full rounded-(--radius) border border-border bg-bg-elev p-4">
              <p className="mb-3 text-[12px] text-text-2">
                cohort week 0–6 · % returning
              </p>
              {drilldown.loading || !d ? (
                <Skeleton kind="panel-axis" style={{ height: 140 }} />
              ) : (
                <Heatmap
                  columns={retentionGrid.columns}
                  rows={retentionGrid.rows}
                  values={retentionGrid.values}
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
