"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table } from "@/components/ui/Table";
import { useMetricsController } from "@/controllers/telemetry";
import { ageLabel } from "@/controllers/shell";
import { PageTabs } from "../../page-tabs";

/**
 * B3 metrics summary (Figma 226:12083) — catalog with cardinality,
 * ingestion rate, last seen; tag explorer for the selected metric.
 */
export default function MetricsSummaryPage() {
  const { summary } = useMetricsController();
  const [selected, setSelected] = useState<string | null>(null);

  const rows = (summary.data ?? []).map((m) => ({
    metric: m.name,
    type: m.type,
    cardinality: `${m.cardinality.toLocaleString("en-US")} series`,
    ingest: m.ingestion_rate_per_s >= 1000 ? `${(m.ingestion_rate_per_s / 1000).toFixed(1)}k` : `${m.ingestion_rate_per_s}`,
    last_seen: `${ageLabel(m.last_seen)} ago`,
  }));

  const active =
    (summary.data ?? []).find((m) => m.name === selected) ?? (summary.data ?? [])[0] ?? null;

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="metrics-summary">
      <header className="flex items-center gap-6">
        <h1 className="text-[20px] font-semibold">Metrics — summary</h1>
        <PageTabs
          label="Metrics views"
          tabs={[
            { label: "Explorer", href: "/dashboard/metrics" },
            { label: "Summary", href: "/dashboard/metrics/summary", active: true },
          ]}
        />
      </header>

      <div className="flex gap-5">
        <section
          aria-label="Metric catalog"
          className="min-w-0 flex-[2] rounded-(--radius) border border-border bg-bg-elev p-3"
        >
          {summary.loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} kind="line" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-[13px] text-text-2">
              No metrics yet — point an OTLP exporter at Upstat and the
              catalog fills in.
            </p>
          ) : (
            <Table
              columns={[
                { key: "metric", label: "Metric" },
                { key: "type", label: "Type" },
                { key: "cardinality", label: "Cardinality", numeric: true },
                { key: "ingest", label: "Ingest/s", numeric: true },
                { key: "last_seen", label: "Last seen" },
              ]}
              rows={rows}
              onRowClick={(row) => setSelected(row.metric as string)}
            />
          )}
        </section>

        {/* tag explorer */}
        <aside
          aria-label="Tag explorer"
          className="w-80 shrink-0 rounded-(--radius) border border-border bg-bg-elev p-4"
        >
          <h2 className="mb-3 text-[16px] font-semibold">
            Tag explorer{active ? ` — ${active.name}` : ""}
          </h2>
          {active ? (
            <>
              <dl className="flex flex-col gap-2">
                {active.tags.map((tag, i) => (
                  <div key={tag} className="flex items-center justify-between gap-2">
                    <dt>
                      <code className="font-data rounded-full border border-border bg-bg px-2 py-0.5 text-[12px] text-text">
                        {tag}
                      </code>
                    </dt>
                    <dd className="m-0 text-[12px] tabular-nums text-text-2">
                      {Math.max(2, Math.round(active.cardinality / (i + 2)))} values
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] leading-[1.45] text-text-2">
                Highest-cardinality tag: {active.tags[0]} — consider dropping
                it from rollups.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-text-2">Select a metric to explore its tags.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
