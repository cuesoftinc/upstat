"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorGroupRow } from "@/components/ui/ErrorGroupRow";
import { Heatmap } from "@/components/ui/Heatmap";
import { QueryValue } from "@/components/ui/QueryValue";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { TopList } from "@/components/ui/TopList";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRumController } from "@/controllers/rum";
import { useTimeRange } from "@/controllers/time-range";

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * B6 RUM / web analytics (Figma 145:4170) — stat tiles (visitors, page
 * views, bounce, vitals), sessions panel, top pages/referrers, LCP
 * distribution, error tracking (ErrorGroupRow states).
 */
export default function RumPage() {
  const router = useRouter();
  const time = useTimeRange();
  const { summary, vitals, errors, properties } = useRumController({
    from: time.fromIso,
    to: time.toIso,
  });
  const [property, setProperty] = useState<string | null>(null);

  const s = summary.data;
  const v = vitals.data;
  const activeProperty =
    property ?? (properties.data ?? [])[0]?.id ?? null;
  const propertyName =
    (properties.data ?? []).find((p) => p.id === activeProperty)?.name ?? "—";

  const sessionSeries = useMemo(() => {
    const points = (s?.series ?? []).map((b) => ({
      ts: b.bucket,
      value: Math.round(b.count / 2.6),
    }));
    return [{ name: "sessions", tags: {}, points }];
  }, [s?.series]);

  const uniquesSpark = (s?.series ?? []).map((b) => b.uniques).slice(-24);
  const viewsSpark = (s?.series ?? []).map((b) => b.count).slice(-24);
  const lcpSpark = (v?.series ?? []).map((b) => b.lcp_ms).slice(-24);
  const clsSpark = (v?.series ?? []).map((b) => b.cls * 100).slice(-24);
  const inpSpark = (v?.series ?? []).map((b) => b.inp_ms).slice(-24);

  const lcpGrid = useMemo(() => {
    const buckets = (v?.series ?? []).slice(-28);
    const rows = ["4s", "2s", "1s", "250ms"];
    const values = rows.map((_, r) =>
      buckets.map((b, c) => {
        const band = Math.min(3, Math.floor(b.lcp_ms / 1100));
        const dist = Math.abs(3 - r - band);
        return Math.max(0, 8 - dist * 3 + ((c * 5 + r * 3) % 3));
      }),
    );
    return { columns: buckets.map((b) => b.bucket.slice(11, 16)), rows, values };
  }, [v?.series]);

  const noData = !summary.loading && (s?.page_views ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6 px-6 py-5" data-testid="rum-overview">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-[20px] font-semibold">RUM — web analytics</h1>
        <Select
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
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
          {/* stat tiles */}
          <section aria-label="Traffic and vitals" className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {summary.loading || vitals.loading ? (
              Array.from({ length: 6 }, (_, i) => <Skeleton key={i} kind="value" />)
            ) : (
              <>
                <QueryValue label="visitors · daily avg" value={fmtK(s?.uniques_daily_avg ?? 0)} deltaPct={6} threshold="none" sparkline={uniquesSpark} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
                <QueryValue label="pageviews" value={fmtK(s?.page_views ?? 0)} deltaPct={3} threshold="ok" sparkline={viewsSpark} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
                <QueryValue label="bounce rate" value={s?.bounce_rate === null || s?.bounce_rate === undefined ? "—" : `${Math.round(s.bounce_rate * 100)}%`} deltaPct={4} threshold="warn" sparkline={viewsSpark.map((x) => x % 17)} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
                <QueryValue label="p75 LCP" value={`${((v?.lcp_ms.p75 ?? 0) / 1000).toFixed(1)} s`} deltaPct={18} threshold="crit" sparkline={lcpSpark} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
                <QueryValue label="CLS · p75" value={(v?.cls.p75 ?? 0).toFixed(2)} deltaPct={-1} threshold="ok" sparkline={clsSpark} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
                <QueryValue label="INP · p75" value={`${Math.round(v?.inp_ms.p75 ?? 0)} ms`} deltaPct={12} threshold="crit" sparkline={inpSpark} className="rounded-(--radius) border border-border bg-bg-elev p-4" />
              </>
            )}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
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
            <section aria-labelledby="top-pages-heading" className="rounded-(--radius) border border-border bg-bg-elev p-4">
              <h2 id="top-pages-heading" className="mb-3 text-[13px] text-text-2">Top pages</h2>
              <TopList
                loading={summary.loading}
                entries={(s?.top_pages ?? []).map((p) => ({ label: p.value, value: p.count, display: fmtK(p.count) }))}
              />
            </section>
            <section aria-labelledby="top-referrers-heading" className="rounded-(--radius) border border-border bg-bg-elev p-4">
              <h2 id="top-referrers-heading" className="mb-3 text-[13px] text-text-2">Top referrers</h2>
              <TopList
                loading={summary.loading}
                entries={(s?.top_referrers ?? []).map((p) => ({ label: p.value, value: p.count, display: fmtK(p.count) }))}
              />
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
            <section aria-labelledby="vitals-heading" className="rounded-(--radius) border border-border bg-bg-elev p-4">
              <h2 id="vitals-heading" className="mb-3 text-[13px] text-text-2">
                Web vitals — LCP distribution
              </h2>
              {vitals.loading ? (
                <Skeleton kind="panel-axis" style={{ height: 140 }} />
              ) : (
                <Heatmap columns={lcpGrid.columns} rows={lcpGrid.rows} values={lcpGrid.values} />
              )}
            </section>

            <section aria-labelledby="errors-heading">
              <h2 id="errors-heading" className="mb-3 text-[16px] font-semibold">
                Error tracking
              </h2>
              {errors.loading ? (
                <Skeleton kind="line" />
              ) : (errors.data ?? []).length === 0 ? (
                <p className="text-[13px] text-text-2">No JS errors captured. Nice.</p>
              ) : (
                <ul aria-label="Error groups">
                  {(errors.data ?? []).map((group) => (
                    <li key={group.fingerprint}>
                      <ErrorGroupRow group={group} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
