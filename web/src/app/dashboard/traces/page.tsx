"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Skeleton } from "@/components/ui/Skeleton";
import { useServicesController } from "@/controllers/telemetry";
import { PageTabs } from "../page-tabs";
import { apmTabs } from "./apm-tabs";

function ms(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

function errTint(rate: number): string {
  if (rate >= 0.04) return "text-crit";
  if (rate >= 0.01) return "text-warn-text";
  return "text-text-2";
}

function apdexTint(apdex: number): string {
  if (apdex < 0.8) return "text-crit";
  if (apdex < 0.94) return "text-warn-text";
  return "text-text-2";
}

/**
 * B5 APM services (Figma 227:11752) — req/s, p50/p95/p99, error rate,
 * apdex; row click → service detail.
 */
export default function ApmServicesPage() {
  const router = useRouter();
  const services = useServicesController();

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="apm-services">
      <header className="flex items-center gap-6">
        <h1 className="text-[20px] font-semibold">APM — services</h1>
        <PageTabs label="APM views" tabs={apmTabs("services")} />
      </header>

      <section
        aria-label="Service list"
        className="rounded-(--radius) border border-border bg-bg-elev p-3"
      >
        {services.loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} kind="line" />
            ))}
          </div>
        ) : (services.data ?? []).length === 0 ? (
          <p className="p-4 text-[13px] text-text-2">
            No services yet — traces populate this list the moment spans arrive.
          </p>
        ) : (
          // overflow-x-auto: the seven-column stats table scrolls inside the
          // panel on narrow viewports (390 support)
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-text-2">
                  <th scope="col" className="px-2 py-2 font-medium">
                    Service
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Req/s
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    P50
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    P95
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    P99
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Err %
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Apdex
                  </th>
                </tr>
              </thead>
              <tbody>
                {(services.data ?? []).map((s) => (
                  <tr
                    key={s.service}
                    onClick={() =>
                      router.push(`/dashboard/traces/services/${s.service}`)
                    }
                    className="cursor-pointer border-t border-border transition-colors duration-[var(--duration-fast)] hover:bg-bg"
                  >
                    <th
                      scope="row"
                      className="px-2 py-2.5 text-left font-normal"
                    >
                      <span className="font-data text-text">{s.service}</span>
                    </th>
                    <td className="font-data px-2 py-2.5 text-right tabular-nums text-text-2">
                      {s.req_per_s >= 1000
                        ? `${(s.req_per_s / 1000).toFixed(1)}k`
                        : Math.round(s.req_per_s)}
                    </td>
                    <td className="font-data px-2 py-2.5 text-right tabular-nums text-text-2">
                      {ms(s.p50_ms)}
                    </td>
                    <td className="font-data px-2 py-2.5 text-right tabular-nums text-text-2">
                      {ms(s.p95_ms)}
                    </td>
                    <td className="font-data px-2 py-2.5 text-right tabular-nums text-text-2">
                      {ms(s.p99_ms)}
                    </td>
                    <td
                      className={clsx(
                        "font-data px-2 py-2.5 text-right tabular-nums",
                        errTint(s.error_rate),
                      )}
                    >
                      {(s.error_rate * 100).toFixed(1)}%
                    </td>
                    <td
                      className={clsx(
                        "font-data px-2 py-2.5 text-right tabular-nums",
                        apdexTint(s.apdex),
                      )}
                    >
                      {s.apdex.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
