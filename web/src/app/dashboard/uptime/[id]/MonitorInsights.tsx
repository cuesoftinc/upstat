"use client";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMonitorInsightsController } from "@/controllers/monitors";

export function MonitorInsights({ monitorId }: { monitorId: string }) {
  const insights = useMonitorInsightsController(monitorId);

  return (
    <section
      aria-labelledby="insight-heading"
      className="rounded-(--radius) border border-border bg-bg-elev p-4"
    >
      <h2 id="insight-heading" className="mb-2 text-[16px] font-semibold">
        Insight
      </h2>
      {insights.loading ? (
        <Skeleton kind="line" />
      ) : insights.error ? (
        <div role="alert" className="space-y-2">
          <p className="text-[13px] text-text-2">
            Insights could not be loaded.
          </p>
          <Button kind="quiet" onClick={() => void insights.reload()}>
            Retry insights
          </Button>
        </div>
      ) : !insights.data?.length ? (
        <p className="text-[13px] text-text-2">
          No insights yet for this monitor.
        </p>
      ) : (
        <ul className="space-y-4">
          {insights.data.map((insight) => (
            <li key={insight.id} className="space-y-2">
              <h3 className="text-[13px] font-medium text-text">
                {insight.summary}
              </h3>
              {insight.narrative && (
                <p className="whitespace-pre-wrap text-[13px] leading-[1.45] text-text-2">
                  {insight.narrative}
                </p>
              )}
              {insight.recommended_action && (
                <p className="text-[13px] text-text-2">
                  Recommended action — {insight.recommended_action}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
