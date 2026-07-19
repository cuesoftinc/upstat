"use client";

/**
 * Explorer controllers — the QueryBar mechanics shared by the B3/B4/B5
 * explorers: facet pills (MI-6), the ⌘click pivot target (MI-5), query
 * autocomplete inputs (MI-13), saved views (MI-18), and the B3 metrics
 * explorer itself (query run + save-to-dashboard).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueryFilter } from "@/components/ui/QueryBar";
import {
  ApiError,
  type QueryResult,
  type SavedView,
  type SavedViewSurface,
  type Widget,
} from "@/models";
import { dashboardsRepo, queryRepo, viewsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";
import { useTimeRange } from "./time-range";

/* ------------------------------------------------------------------ */
/* Query-string ↔ pills mechanics                                       */
/* ------------------------------------------------------------------ */

/** Split a shared-grammar string into facet pills + the free/agg remainder. */
export function splitQuery(q: string): { pills: QueryFilter[]; text: string } {
  const [filterPart, ...aggParts] = q.split("|");
  const pills: QueryFilter[] = [];
  const rest: string[] = [];
  for (const raw of (filterPart ?? "").split(/\s+/).filter(Boolean)) {
    const negated = raw.startsWith("-");
    const term = negated ? raw.slice(1) : raw;
    const idx = term.indexOf(":");
    if (idx > 0) {
      pills.push({ facet: term.slice(0, idx), value: term.slice(idx + 1), negated });
    } else {
      rest.push(raw);
    }
  }
  const tail = aggParts.length > 0 ? `| ${aggParts.join("|").trim()}` : "";
  return { pills, text: [rest.join(" "), tail].filter(Boolean).join(" ").trim() };
}

/** Rebuild the query string from pills + remainder (URL/API form). */
export function joinQuery(pills: QueryFilter[], text: string): string {
  const pillPart = pills
    .map((p) => `${p.negated ? "-" : ""}${p.facet}:${p.value}`)
    .join(" ");
  return [pillPart, text.trim()].filter(Boolean).join(" ").trim();
}

export interface QueryPillsState {
  pills: QueryFilter[];
  text: string;
  setText: (text: string) => void;
  addPill: (facet: string, value: string) => void;
  removePill: (index: number) => void;
  /** Replace the whole state from a query string (saved views, URL). */
  setQuery: (q: string) => void;
  /** The canonical string form of the current state. */
  query: string;
}

export function useQueryPills(initial: string): QueryPillsState {
  const [state, setState] = useState(() => splitQuery(initial));

  const addPill = useCallback((facet: string, value: string) => {
    setState((s) =>
      s.pills.some((p) => p.facet === facet && p.value === value)
        ? s
        : { ...s, pills: [...s.pills, { facet, value }] },
    );
  }, []);

  const removePill = useCallback((index: number) => {
    setState((s) => ({ ...s, pills: s.pills.filter((_, i) => i !== index) }));
  }, []);

  const setText = useCallback((text: string) => {
    setState((s) => ({ ...s, text }));
  }, []);

  const setQuery = useCallback((q: string) => {
    setState(splitQuery(q));
  }, []);

  return {
    ...state,
    setText,
    addPill,
    removePill,
    setQuery,
    query: joinQuery(state.pills, state.text),
  };
}

/** Initial query from the URL (`?q=`), else the given default (deep links). */
export function initialQueryFromUrl(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get("q") ?? fallback;
}

/** Keep `?q=` in the URL in sync (design.md §1 query duality). */
function writeQueryParam(q: string, defaultQuery: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (q && q !== defaultQuery) params.set("q", q);
  else params.delete("q");
  const qs = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

/* ------------------------------------------------------------------ */
/* Saved views (MI-18)                                                  */
/* ------------------------------------------------------------------ */

export function useSavedViews(surface: SavedViewSurface) {
  const state = useRequest(() => viewsRepo.list(surface), [surface]);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (name: string, query: string, scope: SavedView["scope"] = "personal") => {
      setSaving(true);
      try {
        const view = await viewsRepo.create({ name, scope, surface, query });
        await state.reload();
        return view;
      } finally {
        setSaving(false);
      }
    },
    [state, surface],
  );

  const remove = useCallback(
    async (id: string) => {
      await viewsRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  return { ...state, save, remove, saving };
}

/* ------------------------------------------------------------------ */
/* B3 metrics explorer                                                  */
/* ------------------------------------------------------------------ */

export const DEFAULT_METRICS_QUERY =
  "metric:http.request.duration_ms | p95() by service";

export function useMetricsExplorerController() {
  const time = useTimeRange();
  const [defaultQuery] = useState(() => initialQueryFromUrl(DEFAULT_METRICS_QUERY));
  const queryState = useQueryPills(defaultQuery);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  // the last SUBMITTED query — time changes re-run it, edits don't
  const [activeQuery, setActiveQuery] = useState(defaultQuery);
  const seq = useRef(0);

  const runQuery = useCallback(
    async (q: string, fromIso: string, toIso: string) => {
      const id = ++seq.current;
      setRunning(true);
      try {
        const res = await queryRepo.run({ q, from: fromIso, to: toIso });
        if (seq.current === id) {
          setResult(res);
          setSyntaxError(null);
        }
      } catch (e) {
        if (seq.current !== id) return;
        if (e instanceof ApiError && e.code === "invalid_query") {
          setSyntaxError(e.message);
        } else {
          setSyntaxError(e instanceof Error ? e.message : "query failed");
        }
      } finally {
        if (seq.current === id) setRunning(false);
      }
    },
    [],
  );

  // MI-1/MI-3: the active query re-runs whenever the global range moves.
  useEffect(() => {
    void runQuery(activeQuery, time.fromIso, time.toIso);
  }, [activeQuery, time.fromIso, time.toIso, runQuery]);

  const submit = useCallback(() => {
    const q = queryState.query;
    writeQueryParam(q, DEFAULT_METRICS_QUERY);
    setActiveQuery(q);
  }, [queryState.query]);

  /** MI-5/MI-6: pivots submit immediately with the new pill. */
  const pivot = useCallback(
    (facet: string, value: string) => {
      queryState.addPill(facet, value);
      const q = joinQuery(
        [...queryState.pills, { facet, value }],
        queryState.text,
      );
      writeQueryParam(q, DEFAULT_METRICS_QUERY);
      setActiveQuery(q);
    },
    [queryState],
  );

  const applyView = useCallback(
    (view: SavedView) => {
      queryState.setQuery(view.query);
      writeQueryParam(view.query, DEFAULT_METRICS_QUERY);
      setActiveQuery(view.query);
    },
    [queryState],
  );

  /** B3 save-to-dashboard: the current query lands as a timeseries widget. */
  const saveToDashboard = useCallback(
    async (dashboardId: string, title: string) => {
      const widget: Omit<Widget, "id" | "dashboard_id"> = {
        type: "timeseries",
        title,
        query: null,
        query_string: activeQuery,
        viz_options: { display: "line" },
        layout: { x: 0, y: 99, w: 6, h: 3 },
      };
      await dashboardsRepo.addWidget(dashboardId, widget);
    },
    [activeQuery],
  );

  const views = useSavedViews("metrics");

  return {
    queryState,
    result,
    running,
    syntaxError,
    activeQuery,
    submit,
    pivot,
    applyView,
    saveToDashboard,
    views,
    time,
  };
}
