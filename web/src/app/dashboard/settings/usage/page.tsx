"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { UsageMeterRow } from "@/components/ui/UsageMeterRow";
import { useUsageController } from "@/controllers/settings";

/**
 * B12 usage metering (Figma "B12 — Settings (usage metering)", 334:14499)
 * — UsageMeterRow per pillar; month-to-date values computed from the
 * seeded telemetry volumes (accuracy canon: honest numbers), bars scaled
 * to each pillar's trailing-3-month peak, plan column verbatim.
 */
export default function UsagePage() {
  const usage = useUsageController();
  const report = usage.data;

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="settings-usage">
      <h1 className="text-[20px] font-semibold">Settings — usage</h1>

      {usage.loading || !report ? (
        <>
          <Skeleton kind="line" className="w-72" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} kind="panel-axis" style={{ height: 72 }} />
          ))}
        </>
      ) : (
        <>
          <h2 className="text-[16px] font-semibold">
            Month-to-date usage — {report.month_label}
          </h2>
          {report.rows.length === 0 ? (
            <p className="text-[13px] text-text-2">
              No usage yet — meters populate once telemetry flows.
            </p>
          ) : (
            <ul aria-label="Usage meters" className="flex flex-col gap-3">
              {report.rows.map((meter) => (
                <li key={meter.pillar}>
                  <UsageMeterRow meter={meter} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] leading-[1.45] text-text-2">
            Meters show month-to-date ingestion per pillar, scaled to each
            pillar&apos;s trailing-3-month peak. Self-hosting is unmetered;
            Cloud plan quotas are announced at GA.
          </p>
        </>
      )}
    </div>
  );
}
