"use client";

/**
 * Global time state — design.md §1 "time is the primary axis" + MI-1/MI-3.
 *
 * One TimeRangeProvider wraps the /dashboard shell: every panel reads the
 * same range, the TimePicker writes it, drag-zoom pushes onto a zoom stack
 * (breadcrumb chip, double-click resets), and every state has a URL
 * representation (`?range=1h` / `?from=…&to=…`) with back/forward restore.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TimePreset } from "@/components/ui/TimePicker";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const PRESET_MS: Record<TimePreset, number> = {
  "15m": 15 * MINUTE,
  "1h": HOUR,
  "4h": 4 * HOUR,
  "1d": DAY,
  "1w": 7 * DAY,
};

interface Window {
  fromMs: number;
  toMs: number;
}

export interface TimeRangeState {
  preset: TimePreset | "custom";
  fromMs: number;
  toMs: number;
  /** RFC3339 forms for repository params. */
  fromIso: string;
  toIso: string;
  live: boolean;
  /** MI-3 zoom stack depth (0 = not zoomed). */
  zoomDepth: number;
  /** Breadcrumb label for the ZoomStackChip, e.g. `09:12 – 09:40`. */
  zoomLabel: string;
  setPreset: (preset: TimePreset) => void;
  setLive: (live: boolean) => void;
  /** MI-3: zoom to a fraction window of the current range (drag region). */
  zoomBy: (fromFrac: number, toFrac: number) => void;
  resetZoom: () => void;
}

const TimeRangeContext = createContext<TimeRangeState | null>(null);

function hhmm(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

function parseUrl(search: string): { preset: TimePreset | "custom"; window: Window | null; live: boolean } {
  const params = new URLSearchParams(search);
  const live = params.get("live") === "1";
  const from = params.get("from");
  const to = params.get("to");
  if (from && to) {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (!Number.isNaN(fromMs) && !Number.isNaN(toMs) && toMs > fromMs) {
      return { preset: "custom", window: { fromMs, toMs }, live };
    }
  }
  const range = params.get("range") as TimePreset | null;
  if (range && range in PRESET_MS) return { preset: range, window: null, live };
  return { preset: "1h", window: null, live };
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  // Deep links land with ?range= / ?from&to (design.md §1 query duality);
  // window.location avoids the useSearchParams prerender constraint.
  const [init] = useState(() =>
    typeof window === "undefined"
      ? { preset: "1h" as const, window: null, live: false }
      : parseUrl(window.location.search),
  );
  const [preset, setPresetState] = useState<TimePreset | "custom">(init.preset);
  const [live, setLiveState] = useState(init.live);
  const [zoom, setZoom] = useState<Window | null>(init.window);
  // MI-3 zoom stack — state (not a ref): its depth renders in the chip.
  const [stack, setStack] = useState<Window[]>([]);
  // Snapshot "now" once per preset selection so ranges stay stable across
  // renders (panels re-query on range change, not on every render).
  const [anchor, setAnchor] = useState(() => Date.now());

  const base: Window = useMemo(() => {
    const span = preset === "custom" ? HOUR : PRESET_MS[preset];
    return { fromMs: anchor - span, toMs: anchor };
  }, [preset, anchor]);

  const current = zoom ?? base;

  const writeUrl = useCallback(
    (next: { preset: TimePreset | "custom"; window: Window | null; live: boolean }, push: boolean) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      params.delete("range");
      params.delete("from");
      params.delete("to");
      params.delete("live");
      if (next.window) {
        params.set("from", new Date(next.window.fromMs).toISOString());
        params.set("to", new Date(next.window.toMs).toISOString());
      } else if (next.preset !== "custom") {
        params.set("range", next.preset);
      }
      if (next.live) params.set("live", "1");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [],
  );

  // MI-1: back/forward restores the time state.
  useEffect(() => {
    const onPop = () => {
      const parsed = parseUrl(window.location.search);
      setPresetState(parsed.preset);
      setZoom(parsed.window);
      setLiveState(parsed.live);
      if (!parsed.window) setStack([]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setPreset = useCallback(
    (p: TimePreset) => {
      setStack([]);
      setZoom(null);
      setPresetState(p);
      setAnchor(Date.now());
      writeUrl({ preset: p, window: null, live }, true);
    },
    [live, writeUrl],
  );

  const setLive = useCallback(
    (l: boolean) => {
      setLiveState(l);
      if (l) setAnchor(Date.now());
      writeUrl({ preset, window: zoom, live: l }, false);
    },
    [preset, zoom, writeUrl],
  );

  const zoomBy = useCallback(
    (fromFrac: number, toFrac: number) => {
      const span = current.toMs - current.fromMs;
      const next: Window = {
        fromMs: Math.round(current.fromMs + fromFrac * span),
        toMs: Math.round(current.fromMs + toFrac * span),
      };
      if (next.toMs - next.fromMs < 10_000) return; // sanity floor: 10s
      setStack((prev) => [...prev, current]);
      setZoom(next);
      writeUrl({ preset, window: next, live }, true);
    },
    [current, preset, live, writeUrl],
  );

  const resetZoom = useCallback(() => {
    setStack([]);
    setZoom(null);
    writeUrl({ preset, window: null, live }, true);
  }, [preset, live, writeUrl]);

  const value: TimeRangeState = useMemo(
    () => ({
      preset: zoom ? "custom" : preset,
      fromMs: current.fromMs,
      toMs: current.toMs,
      fromIso: new Date(current.fromMs).toISOString(),
      toIso: new Date(current.toMs).toISOString(),
      live,
      zoomDepth: zoom ? stack.length || 1 : 0,
      zoomLabel: `${hhmm(current.fromMs)} – ${hhmm(current.toMs)}`,
      setPreset,
      setLive,
      zoomBy,
      resetZoom,
    }),
    [zoom, stack.length, preset, current, live, setPreset, setLive, zoomBy, resetZoom],
  );

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange(): TimeRangeState {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error("useTimeRange requires TimeRangeProvider (the /dashboard shell)");
  return ctx;
}
