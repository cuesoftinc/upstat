"use client";

/**
 * B4 logs explorer controller — FacetSidebar filtering (MI-6), the MI-5
 * ⌘click pivot, and MI-4 live tail: 2s polling, scroll-up pauses (PAUSED
 * pill + buffered count), resume flushes with a catch-up scroll.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEvent } from "@/models";
import { logsRepo } from "@/models/repositories";
import {
  initialQueryFromUrl,
  joinQuery,
  useQueryPills,
  useSavedViews,
} from "./explorer";
import { useRequest } from "./use-request";
import { useTimeRange } from "./time-range";

const TAIL_POLL_MS = 2_000;
const TAIL_MAX = 400;
/** Explorer page size — URL-overridable (`?limit=`, B4 virtualized list). */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 10_000;

/** `?limit=` — deep-linkable page size (design.md §1 query duality); the
 *  virtualized list (B4) keeps even MAX_LIMIT results smooth. */
function limitFromUrl(): number {
  if (typeof window === "undefined") return DEFAULT_LIMIT;
  const raw = Number(
    new URLSearchParams(window.location.search).get("limit"),
  );
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

export function useLogsExplorerController() {
  const time = useTimeRange();
  const [initialQuery] = useState(() => initialQueryFromUrl(""));
  const queryState = useQueryPills(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [limit] = useState(limitFromUrl);

  const base = useRequest(
    () =>
      logsRepo.query({
        q: activeQuery,
        from: time.fromIso,
        to: time.toIso,
        limit,
      }),
    [activeQuery, time.fromIso, time.toIso, limit],
  );

  /* ---------------- MI-4 live tail ---------------- */
  const live = time.live;
  const [tail, setTail] = useState<LogEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [buffered, setBuffered] = useState<LogEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);

  // effect-mirrored (never written during render — react-hooks/refs)
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    seen.current = new Set();
    const poll = async (first: boolean) => {
      try {
        const page = await logsRepo.query({
          q: activeQuery,
          live: 1,
          limit: 60,
        });
        if (stopped) return;
        const fresh = page.events.filter((e) => !seen.current.has(e.id));
        for (const e of fresh) seen.current.add(e.id);
        if (first) {
          // entering live tail: fresh window, unpaused
          setTail(fresh.slice(0, TAIL_MAX));
          setBuffered([]);
          setPaused(false);
          return;
        }
        if (fresh.length === 0) return;
        if (pausedRef.current) {
          setBuffered((prev) => [...fresh, ...prev]);
        } else {
          setTail((prev) => [...fresh, ...prev].slice(0, TAIL_MAX));
        }
      } catch {
        // live tail is best-effort; the next poll retries
      }
    };
    void poll(true);
    const timer = window.setInterval(() => void poll(false), TAIL_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [live, activeQuery]);

  /** View calls this when the user scrolls away from the tail edge. */
  const pause = useCallback(() => setPaused(true), []);

  /** Click on the buffered chip: flush + resume (the view scrolls back). */
  const resume = useCallback(() => {
    setTail((prev) => [...buffered, ...prev].slice(0, TAIL_MAX));
    setBuffered([]);
    setPaused(false);
  }, [buffered]);

  /* ---------------- query submission ---------------- */

  const writeUrl = useCallback((q: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }, []);

  const submitQuery = useCallback(
    (q: string) => {
      writeUrl(q);
      setActiveQuery(q);
      setTail([]);
      setBuffered([]);
      seen.current = new Set();
    },
    [writeUrl],
  );

  const submit = useCallback(() => {
    submitQuery(queryState.query);
  }, [submitQuery, queryState.query]);

  /** MI-5 pivot / MI-6 facet toggle — both submit immediately. */
  const pivot = useCallback(
    (facet: string, value: string) => {
      queryState.addPill(facet, value);
      submitQuery(
        joinQuery([...queryState.pills, { facet, value }], queryState.text),
      );
    },
    [queryState, submitQuery],
  );

  const toggleFacet = useCallback(
    (facet: string, value: string) => {
      const idx = queryState.pills.findIndex(
        (p) => p.facet === facet && p.value === value,
      );
      const pills =
        idx === -1
          ? [...queryState.pills, { facet, value }]
          : queryState.pills.filter((_, i) => i !== idx);
      if (idx === -1) queryState.addPill(facet, value);
      else queryState.removePill(idx);
      submitQuery(joinQuery(pills, queryState.text));
    },
    [queryState, submitQuery],
  );

  const removePill = useCallback(
    (index: number) => {
      queryState.removePill(index);
      submitQuery(
        joinQuery(
          queryState.pills.filter((_, i) => i !== index),
          queryState.text,
        ),
      );
    },
    [queryState, submitQuery],
  );

  const views = useSavedViews("logs");
  const applyView = useCallback(
    (query: string) => {
      queryState.setQuery(query);
      submitQuery(query);
    },
    [queryState, submitQuery],
  );

  /** Selected facet values per facet name (FacetSidebar checkboxes). */
  const selectedFacets: Record<string, string[]> = {};
  for (const p of queryState.pills) {
    (selectedFacets[p.facet] ??= []).push(p.value);
  }

  const events = live ? tail : (base.data?.events ?? []);

  return {
    time,
    queryState,
    base,
    events,
    live,
    paused,
    bufferedCount: buffered.length,
    pause,
    resume,
    submit,
    pivot,
    toggleFacet,
    removePill,
    selectedFacets,
    views,
    applyView,
  };
}

/**
 * §5 keyboard navigation for the log list — `j`/`k` move focus between
 * LogLine header buttons (Enter then expands via native button
 * semantics). The ShortcutCheatsheet advertised j/k with no
 * implementation behind it (completeness fix 2026-07-19).
 */
export function useLogLineKeys(listRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key !== "j" && e.key !== "k") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const list = listRef.current;
      if (!list) return;
      // LogLine header buttons carry aria-expanded (the JSON tree's inner
      // copy buttons don't) — those are the navigable rows
      const rows = [
        ...list.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"),
      ];
      if (rows.length === 0) return;
      const current = rows.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === "j"
          ? Math.min(current + 1, rows.length - 1)
          : Math.max(current - 1, 0);
      rows[next]?.focus();
      rows[next]?.scrollIntoView({ block: "nearest" });
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listRef]);
}
