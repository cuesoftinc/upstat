"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { clsx } from "clsx";
import { Heatmap } from "@/components/ui/Heatmap";
import { ServiceMapNode } from "@/components/ui/ServiceMapNode";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import {
  useQueryController,
  useServicesController,
  useTracesController,
} from "@/controllers/telemetry";
import { serviceDependencies } from "@/controllers/service-map";
import { seriesToHeatmap } from "@/controllers/widgets";
import { useTimeRange } from "@/controllers/time-range";

function fmtMs(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

/**
 * B5 service detail (Figma 227:11920) — endpoints table, latency
 * distribution, dependency nodes, latency percentiles panel.
 */
export default function ServiceDetailPage() {
  const { service } = useParams<{ service: string }>();
  const time = useTimeRange();
  const services = useServicesController();
  const stats =
    (services.data ?? []).find((s) => s.service === service) ?? null;

  const latency = useQueryController(
    `metric:http.request.duration_ms service:${service} | p50(), p95(), p99()`,
  );
  const traces = useTracesController({
    q: `service:${service}`,
    from: time.fromIso,
    to: time.toIso,
  });

  // endpoints: trace summaries grouped by root_name
  const endpointMap = new Map<
    string,
    { count: number; total: number; errors: number }
  >();
  for (const t of traces.data ?? []) {
    const e = endpointMap.get(t.root_name) ?? { count: 0, total: 0, errors: 0 };
    e.count += 1;
    e.total += t.duration_ms;
    if (t.status === "error") e.errors += 1;
    endpointMap.set(t.root_name, e);
  }
  const endpoints = [...endpointMap.entries()]
    .map(([name, e]) => ({
      name,
      reqPerS: Math.round((e.count / 60) * 100) / 100,
      p95: e.total / e.count,
      errPct: (e.errors / e.count) * 100,
    }))
    .sort((a, b) => b.reqPerS - a.reqPerS);

  const ts = latency.data?.kind === "timeseries" ? latency.data : null;
  const deps = serviceDependencies(service);
  const depStats = (services.data ?? []).filter((s) =>
    deps.includes(s.service),
  );

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="service-detail">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard/traces" className="hover:text-text">
            APM / Services /
          </Link>
        </nav>
        <h1 className="font-data mt-1 text-[24px] font-semibold">{service}</h1>
        {stats && (
          <p className="font-data mt-1 text-[13px] tabular-nums text-text-2">
            {stats.req_per_s >= 1000
              ? `${(stats.req_per_s / 1000).toFixed(1)}k`
              : Math.round(stats.req_per_s)}{" "}
            req/s · p95 {fmtMs(stats.p95_ms)} ·{" "}
            {(stats.error_rate * 100).toFixed(1)}% err · apdex{" "}
            {stats.apdex.toFixed(2)}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section
          aria-labelledby="endpoints-heading"
          className="rounded-(--radius) border border-border bg-bg-elev p-4"
        >
          <h2 id="endpoints-heading" className="mb-3 text-[16px] font-semibold">
            Endpoints
          </h2>
          {traces.loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} kind="line" />
              ))}
            </div>
          ) : endpoints.length === 0 ? (
            <p className="text-[13px] text-text-2">
              No traced endpoints in this range.
            </p>
          ) : (
            // overflow-x-auto: the endpoints table scrolls inside the panel
            // on narrow viewports (390 support)
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-text-2">
                    <th scope="col" className="px-2 py-1.5 font-medium">
                      Endpoint
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-medium"
                    >
                      Req/s
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-medium"
                    >
                      P95
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-medium"
                    >
                      Err %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((e) => (
                    <tr key={e.name} className="border-t border-border">
                      <th
                        scope="row"
                        className="font-data px-2 py-2 text-left font-normal text-text"
                      >
                        {e.name}
                      </th>
                      <td className="font-data px-2 py-2 text-right tabular-nums text-text-2">
                        {e.reqPerS}
                      </td>
                      <td className="font-data px-2 py-2 text-right tabular-nums text-text-2">
                        {fmtMs(e.p95)}
                      </td>
                      <td
                        className={clsx(
                          "font-data px-2 py-2 text-right tabular-nums",
                          e.errPct >= 1 ? "text-crit" : "text-text-2",
                        )}
                      >
                        {e.errPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="latency-heading">
            <h2 id="latency-heading" className="mb-3 text-[16px] font-semibold">
              Latency distribution
            </h2>
            <div className="rounded-(--radius) border border-border bg-bg-elev p-4">
              {latency.loading ? (
                <Skeleton kind="panel-axis" style={{ height: 140 }} />
              ) : (
                <Heatmap {...seriesToHeatmap(ts?.series[1] ?? ts?.series[0])} />
              )}
            </div>
          </section>

          <section aria-labelledby="deps-heading">
            <h2 id="deps-heading" className="mb-3 text-[16px] font-semibold">
              Dependencies
            </h2>
            <ul className="flex flex-wrap items-center gap-6">
              {depStats.map((s, i) => (
                <li key={s.service}>
                  <Link href={`/dashboard/traces/services/${s.service}`}>
                    <ServiceMapNode
                      name={s.service}
                      reqPerS={s.req_per_s}
                      errorRate={s.error_rate}
                      colorIndex={i}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section aria-label="Latency percentiles">
        <TimeseriesPanel
          title={`latency percentiles — ${service}`}
          query={`metric:http.request.duration_ms service:${service} | p50(), p95(), p99()`}
          series={ts?.series ?? []}
          loading={latency.loading}
          height={200}
          onZoomRange={time.zoomBy}
          onZoomReset={time.resetZoom}
        />
      </section>
    </div>
  );
}
