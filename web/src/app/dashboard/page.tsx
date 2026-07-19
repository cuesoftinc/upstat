"use client";

import { useRouter } from "next/navigation";
import { AlertFeedRow } from "@/components/ui/AlertFeedRow";
import { DashboardListRow } from "@/components/ui/DashboardListRow";
import { QueryValue } from "@/components/ui/QueryValue";
import { SLOCard } from "@/components/ui/SLOCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ageLabel } from "@/controllers/shell";
import { useOrgHomeController } from "@/controllers/org-home";

/**
 * B1 Home — org health at a glance (Figma 125:13): stat tiles, watched
 * dashboards, triggered monitors, SLO burn. The persistent sev1/2 banner
 * renders in the shell (MI-14).
 */
export default function DashboardHomePage() {
  const router = useRouter();
  const { tiles, dashboards, watched, feed, slos } = useOrgHomeController();

  return (
    <div data-testid="dashboard-home" className="flex flex-col gap-8 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Home — org health</h1>

      {/* stat tiles */}
      <section
        aria-label="Org health stats"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {tiles.loading || !tiles.data
          ? Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} kind="value" />
            ))
          : tiles.data.map((tile) => (
              <QueryValue
                key={tile.label}
                label={tile.label}
                value={tile.value}
                deltaPct={tile.deltaPct}
                threshold={tile.threshold}
                sparkline={tile.sparkline}
                className="rounded-(--radius) border border-border bg-bg-elev p-4"
              />
            ))}
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* watched dashboards */}
        <section aria-labelledby="watched-heading" className="min-w-0">
          <h2 id="watched-heading" className="mb-3 text-[16px] font-semibold">
            Watched dashboards
          </h2>
          {dashboards.loading ? (
            <Skeleton kind="line" />
          ) : watched.length === 0 ? (
            <p className="text-[13px] leading-[1.45] text-text-2">
              No dashboards yet —{" "}
              <button
                type="button"
                onClick={() => router.push("/dashboard/dashboards")}
                className="text-brand hover:underline"
              >
                create your first dashboard
              </button>
              .
            </p>
          ) : (
            <ul aria-label="Dashboards">
              {watched.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <DashboardListRow
                    name={d.name}
                    updated={`updated ${ageLabel(d.updated_at)} ago`}
                    favorite={d.favorite}
                    shared={d.shared}
                    onClick={() => router.push(`/dashboard/dashboards/${d.id}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* triggered monitors */}
        <section aria-labelledby="triggered-heading" className="min-w-0">
          <h2 id="triggered-heading" className="mb-3 text-[16px] font-semibold">
            Triggered monitors
          </h2>
          {feed.loading ? (
            <Skeleton kind="line" />
          ) : (feed.data ?? []).length === 0 ? (
            <p className="text-[13px] leading-[1.45] text-text-2">
              Quiet — nothing has triggered.
            </p>
          ) : (
            <ul>
              {(feed.data ?? []).map((event) => (
                <li key={event.id}>
                  <AlertFeedRow
                    event={event}
                    onClick={() => router.push("/dashboard/monitors")}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* SLO burn */}
      <section aria-labelledby="slo-heading">
        <h2 id="slo-heading" className="mb-3 text-[16px] font-semibold">
          SLO burn
        </h2>
        {slos.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} kind="value" />
            ))}
          </div>
        ) : (slos.data ?? []).length === 0 ? (
          <p className="text-[13px] leading-[1.45] text-text-2">
            No SLOs defined —{" "}
            <button
              type="button"
              onClick={() => router.push("/dashboard/slos")}
              className="text-brand hover:underline"
            >
              define your first SLO
            </button>
            .
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {(slos.data ?? []).map((slo) => (
              <li key={slo.id} className="min-w-0">
                <SLOCard slo={slo} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
