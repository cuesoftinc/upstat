"use client";

import { Input } from "@/components/ui/Input";
import { QueryValue } from "@/components/ui/QueryValue";
import { ServiceCatalogRow } from "@/components/ui/ServiceCatalogRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCatalogPageController } from "@/controllers/catalog";

/**
 * B11 Service catalog (Figma 146:4635) — searchable registry with
 * telemetry-presence dots + owner/repo/runbook, and a selected-service
 * detail rail (req/s · p95 · error rate · env chips).
 */
export default function ServiceCatalogPage() {
  const {
    catalog,
    entries,
    search,
    setSearch,
    selected,
    select,
    detail,
    stats,
  } = useCatalogPageController();

  const last = (points: number[]) => points[points.length - 1] ?? 0;

  return (
    <div
      data-testid="service-catalog"
      className="flex flex-col gap-5 px-6 py-5"
    >
      <h1 className="text-[20px] font-semibold">Service catalog</h1>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Services" className="flex min-w-0 flex-col gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search services… (name, owner, tag)"
            aria-label="Search services"
            className="max-w-[420px]"
          />

          {catalog.loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} kind="line" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] leading-[1.45] text-text-2">
              {search
                ? `No services match “${search}”.`
                : "No services registered yet — services appear here as soon as their telemetry flows."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <ServiceCatalogRow
                    entry={entry}
                    onClick={() => select(entry.id)}
                    className={
                      selected?.id === entry.id ? "border-brand/60" : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-text-2">
            telemetry presence: colored dots = metrics / logs / traces / RUM
            flowing · repo + runbook chips from service manifest
          </p>
        </section>

        {/* selected-service detail rail */}
        {selected && (
          <aside
            aria-label={`${selected.name} detail`}
            className="flex h-fit flex-col gap-4 rounded-(--radius) border border-border bg-bg-elev p-4"
          >
            <header className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                {selected.name}
                <span className="flex gap-1">
                  {selected.environments.map((env) => (
                    <span
                      key={env}
                      className="rounded-(--radius) border border-border px-1.5 py-0.5 text-[11px] font-normal text-text-2"
                    >
                      {env}
                    </span>
                  ))}
                </span>
              </h2>
              <p className="text-[12px] text-text-2">
                owner {selected.owner} ·{" "}
                {selected.links.repo && (
                  <a
                    href={selected.links.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-text hover:underline"
                  >
                    repo
                  </a>
                )}
                {selected.links.runbook && (
                  <>
                    {" · "}
                    <a
                      href={selected.links.runbook}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-text hover:underline"
                    >
                      runbook
                    </a>
                  </>
                )}
              </p>
            </header>

            {detail.loading || !detail.data ? (
              <Skeleton kind="panel-axis" style={{ height: 220 }} />
            ) : (
              <div className="flex flex-col gap-3">
                <QueryValue
                  label="req/s"
                  value={`${Math.round(last(detail.data.reqs))}`}
                  sparkline={detail.data.reqs}
                  threshold="none"
                  className="rounded-(--radius) border border-border bg-bg p-3"
                />
                <QueryValue
                  label="p95 latency"
                  value={`${Math.round(last(detail.data.p95))} ms`}
                  sparkline={detail.data.p95}
                  threshold={last(detail.data.p95) >= 800 ? "warn" : "none"}
                  className="rounded-(--radius) border border-border bg-bg p-3"
                />
                <QueryValue
                  label="error rate"
                  value={`${(stats ? stats.error_rate * 100 : 0).toFixed(1)}%`}
                  sparkline={detail.data.errs}
                  threshold={
                    stats && stats.error_rate >= 0.05 ? "crit" : "none"
                  }
                  className="rounded-(--radius) border border-border bg-bg p-3"
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
