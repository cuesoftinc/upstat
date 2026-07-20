"use client";

/**
 * ReplayPanel — the MI-9 test-replay rendering shared by B7 monitor detail
 * and B8 rule screens: 24h series with ThresholdOverlay (warn/crit bands +
 * would-have-fired markers) and the firing summary.
 */

import {
  PAD_B,
  PAD_L,
  PAD_R,
  PAD_T,
  PLOT_W,
  TimeseriesPanel,
} from "@/components/ui/TimeseriesPanel";
import { ThresholdOverlay } from "@/components/ui/ThresholdOverlay";
import { plotScale } from "@/design/chart-scale";
import type { RuleTestResult } from "@/models";

export function ReplayPanel({
  result,
  title,
}: {
  result: RuleTestResult;
  title: string;
}) {
  const points = result.series[0]?.points ?? [];
  const values = result.series.flatMap((s) =>
    s.points.map((p) => p.value ?? 0),
  );
  // Same domain rule as the panel's own axis (plotScale) so the overlay's
  // threshold fractions land on the plotted gridlines.
  const { domainMin, domainMax } = plotScale(values);
  const yFrac = (v: number) =>
    Math.min(Math.max((v - domainMin) / (domainMax - domainMin), 0), 1);
  const fromMs = points.length > 0 ? Date.parse(points[0].ts) : 0;
  const toMs = points.length > 0 ? Date.parse(points[points.length - 1].ts) : 1;
  const span = Math.max(toMs - fromMs, 1);

  const frac = (ts: string) => (Date.parse(ts) - fromMs) / span;
  const height = 200;

  return (
    <figure className="relative m-0" data-testid="replay-panel">
      <TimeseriesPanel
        title={title}
        query={result.query_string}
        series={result.series}
        height={height}
        withLegend={false}
      />
      {/* overlay across the plot region only (panel padding + header offset) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          // p-3 (12px) + title row + query chip row ≈ 76px of header chrome
          top: 76 + (PAD_T / height) * height,
          left: `calc(12px + ${(PAD_L / PLOT_W) * 100}%)`,
          right: `calc(12px + ${(PAD_R / PLOT_W) * 100}%)`,
          height: height - PAD_T - PAD_B,
        }}
      >
        <div className="relative h-full w-full">
          <ThresholdOverlay
            warnFrom={
              result.thresholds.warn !== null
                ? yFrac(result.thresholds.warn)
                : undefined
            }
            critFrom={yFrac(result.thresholds.crit)}
            markers={result.markers.map(frac)}
          />
        </div>
      </div>
      <figcaption className="font-data mt-1 text-[11px] text-crit">
        would have fired ×{result.would_have_fired}
        <span className="text-text-2">
          {" "}
          · warn {result.thresholds.warn ?? "—"} · crit {result.thresholds.crit}{" "}
          · window {result.thresholds.window}
        </span>
      </figcaption>
    </figure>
  );
}
