"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryBar } from "@/components/ui/QueryBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { TraceWaterfall } from "@/components/ui/TraceWaterfall";
import { initialQueryFromUrl, joinQuery, useQueryPills } from "@/controllers/explorer";
import { useTraceController, useTracesController } from "@/controllers/telemetry";
import { useTimeRange } from "@/controllers/time-range";
import { PageTabs } from "../../page-tabs";
import { apmTabs } from "../apm-tabs";

function fmtMs(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(1)} ms`;
}

/**
 * B5 trace explorer (Figma 129:1695) — search by service/status →
 * TraceWaterfall (MI-7) with span drawer + minimap highlight; the root
 * service cross-links into the service map.
 */
export default function TraceExplorerPage() {
  const time = useTimeRange();
  const [initialQuery] = useState(() => initialQueryFromUrl(""));
  const queryState = useQueryPills(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const traces = useTracesController({
    q: activeQuery,
    from: time.fromIso,
    to: time.toIso,
  });
  const trace = useTraceController(selectedId ?? "");

  const submit = useCallback(() => {
    setActiveQuery(joinQuery(queryState.pills, queryState.text));
  }, [queryState.pills, queryState.text]);

  // guard the stale-data window while the detail request is in flight
  const selected =
    selectedId && trace.data && trace.data.trace_id === selectedId ? trace.data : null;

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="trace-explorer">
      <header className="flex items-center gap-6">
        <h1 className="text-[20px] font-semibold">Traces</h1>
        <PageTabs label="APM views" tabs={apmTabs("traces")} />
      </header>

      <QueryBar
        pills={queryState.pills}
        onRemovePill={(i) => {
          queryState.removePill(i);
          setActiveQuery(joinQuery(queryState.pills.filter((_, idx) => idx !== i), queryState.text));
        }}
        text={queryState.text}
        onTextChange={queryState.setText}
        onSubmit={submit}
        placeholder="service:api-common status:error duration:>500"
      />

      {/* trace list */}
      <section aria-label="Traces" className="rounded-(--radius) border border-border bg-bg-elev">
        {traces.loading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} kind="line" />
            ))}
          </div>
        ) : (traces.data ?? []).length === 0 ? (
          <EmptyState pillar="traces" className="border-0" />
        ) : (
          // overflow-x-auto: the fixed-column result rows scroll inside the
          // panel on narrow viewports (390 support)
          <ul aria-label="Trace results" className="max-h-72 overflow-y-auto overflow-x-auto">
            {(traces.data ?? []).map((t) => (
              <li key={t.trace_id} className="min-w-max">
                <button
                  type="button"
                  data-testid={`trace-${t.trace_id.slice(0, 8)}`}
                  onClick={() => setSelectedId(t.trace_id)}
                  aria-current={selectedId === t.trace_id ? "true" : undefined}
                  className={clsx(
                    "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left",
                    "transition-colors duration-[var(--duration-fast)] hover:bg-bg",
                    selectedId === t.trace_id && "bg-bg",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "size-2 shrink-0 rounded-full",
                      t.status === "error" ? "bg-crit" : "bg-ok",
                    )}
                  />
                  <span className="font-data w-64 truncate text-[13px] text-text">{t.root_name}</span>
                  <span className="w-28 truncate text-[12px] text-text-2">{t.root_service}</span>
                  <span className="font-data w-20 text-right text-[12px] tabular-nums text-text-2">
                    {fmtMs(t.duration_ms)}
                  </span>
                  <span className="w-16 text-right text-[12px] tabular-nums text-text-2">
                    {t.span_count} spans
                  </span>
                  <span className="font-data ml-auto text-[11px] tabular-nums text-text-2">
                    {t.start.slice(11, 19)}Z
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* waterfall + span drawer (MI-7) */}
      {selectedId && (
        <section
          aria-label="Trace waterfall"
          className="rounded-(--radius) border border-border bg-bg-elev p-4"
          data-testid="trace-waterfall"
        >
          {trace.loading || !selected ? (
            <Skeleton kind="panel-axis" style={{ height: 200 }} />
          ) : (
            <>
              <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold">Trace — {selected.root_name}</h2>
                <Link
                  href={`/dashboard/traces/map?service=${selected.root_service}`}
                  className="text-[12px] text-brand hover:underline"
                  data-testid="map-crosslink"
                >
                  View {selected.root_service} in service map →
                </Link>
              </header>
              <TraceWaterfall trace={selected} />
              <p className="font-data mt-2 text-[11px] tabular-nums text-text-2">
                trace_id {selected.trace_id.slice(0, 16)} · {selected.span_count} spans ·{" "}
                {fmtMs(selected.duration_ms)} total
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
