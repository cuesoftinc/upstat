"use client";

import { useCallback, useState } from "react";
import {
  logsRepo,
  metricsRepo,
  queryRepo,
  tracesRepo,
} from "@/models/repositories";
import type {
  LogEvent,
  LogQueryPage,
  QueryRequest,
  QueryResult,
  Trace,
} from "@/models";
import { useRequest } from "./use-request";
import { useTimeRange } from "./time-range";

/** Metrics controller — explorer query + catalog summary (pages.md B3). */
export function useMetricsController() {
  const summary = useRequest(() => metricsRepo.summary(), []);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const run = useCallback(async (req: QueryRequest) => {
    setRunning(true);
    setQueryError(null);
    try {
      setResult(await queryRepo.run(req));
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : "query_failed");
    } finally {
      setRunning(false);
    }
  }, []);

  return { summary, result, run, running, queryError };
}

/** Logs controller — query + cursor pagination + live tail (pages.md B4, MI-4). */
export function useLogsController(params: {
  q?: string;
  from?: string;
  to?: string;
}) {
  const state = useRequest<LogQueryPage>(
    () => logsRepo.query({ ...params, limit: 100 }),
    [params.q, params.from, params.to],
  );
  const [older, setOlder] = useState<LogQueryPage["events"]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    const cursor = state.data?.next_cursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await logsRepo.query({ ...params, cursor, limit: 100 });
      setOlder((prev) => [...prev, ...page.events]);
    } finally {
      setLoadingMore(false);
    }
  }, [state.data?.next_cursor, loadingMore, params]);

  const events = [...(state.data?.events ?? []), ...older];
  return { ...state, events, loadMore, loadingMore };
}

/** One-shot query against the global time range (detail panels, tiles). */
export function useQueryController(q: string) {
  const time = useTimeRange();
  return useRequest<QueryResult>(
    () => queryRepo.run({ q, from: time.fromIso, to: time.toIso }),
    [q, time.fromIso, time.toIso],
  );
}

/** Traces controller — explorer list + waterfall detail (pages.md B5). */
export function useTracesController(params: {
  q?: string;
  from?: string;
  to?: string;
}) {
  return useRequest(
    () => tracesRepo.list({ ...params, limit: 50 }),
    [params.q, params.from, params.to],
  );
}

export function useTraceController(traceId: string) {
  return useRequest(
    // no id yet → no fetch (the explorer renders the list only)
    () => (traceId ? tracesRepo.get(traceId) : Promise.resolve(null)),
    [traceId],
  );
}

/** APM service list (pages.md B5). */
export function useServicesController() {
  return useRequest(() => tracesRepo.services(), []);
}

/**
 * Logs correlated to a trace (pages.md B5 span drawer, logs-in-span tab):
 * fetches the trace's time window and keeps the lines whose `trace_id`
 * matches. Empty result = honestly no correlated lines (only lines that
 * really carry the id populate the tab).
 */
export function useTraceLogsController(trace: Trace | null) {
  return useRequest<LogEvent[]>(async () => {
    if (!trace) return [];
    const startMs = Date.parse(trace.start);
    const from = new Date(startMs - 5_000).toISOString();
    const to = new Date(startMs + trace.duration_ms + 5_000).toISOString();
    // follow next_cursor so busy windows aren't truncated at one page
    // (PR #168 review); capped — a trace window is seconds long, so the
    // cap is generous headroom, not a correctness ceiling
    const matches: LogEvent[] = [];
    let cursor: string | undefined;
    for (let pageNo = 0; pageNo < 6; pageNo++) {
      const page = await logsRepo.query({
        from,
        to,
        limit: 500,
        ...(cursor ? { cursor } : {}),
      });
      matches.push(...page.events.filter((e) => e.trace_id === trace.trace_id));
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    return matches;
  }, [trace?.trace_id]);
}
