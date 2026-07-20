"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { LogPatternRow } from "@/components/ui/LogPatternRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLogPatternsController } from "@/controllers/logs";

function fmtLines(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * B4 Patterns tab (Figma "B4 — Logs (patterns)", 333:14165) — LogPatternRow
 * per clustered template; expand shows indented sample lines. Shares the
 * explorer's QueryBar/facets/histogram chrome (the page renders those);
 * time-range aware via the global TimePicker (LIVE = the last 15 minutes).
 */
export function PatternsPanel({
  activeQuery,
  live,
}: {
  activeQuery: string;
  live: boolean;
}) {
  const patterns = useLogPatternsController(activeQuery, true);
  const result = patterns.data;

  if (patterns.loading || !result) {
    return (
      <div className="flex flex-col gap-2" data-testid="patterns-panel">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} kind="line" />
        ))}
      </div>
    );
  }

  if (result.patterns.length === 0) {
    return (
      <div data-testid="patterns-panel">
        <EmptyState pillar="logs" />
      </div>
    );
  }

  const windowLabel = live ? "the last 15 minutes" : "the selected range";

  return (
    <div
      className="flex min-h-0 flex-col overflow-y-auto"
      data-testid="patterns-panel"
    >
      <ul aria-label="Log patterns">
        {result.patterns.map((pattern) => (
          <li key={pattern.template}>
            <LogPatternRow
              template={pattern.template}
              count={pattern.count}
              dominantLevel={pattern.dominant_level}
              trend={pattern.trend}
              samples={pattern.samples}
            />
          </li>
        ))}
      </ul>
      <p className="px-2 py-3 text-[12px] text-text-2">
        Patterns cluster {windowLabel} — {result.sampled ? "~" : ""}
        {fmtLines(result.total_lines)} lines into {result.patterns.length}{" "}
        templates. &lt;placeholders&gt; mark the clustered variables.
      </p>
    </div>
  );
}
