"use client";

/**
 * Home (Part A) controller — pages.md A1–A16, web-implementation.md W2.
 *
 * Demo panels feed from the mock seed generators (design.md §8.3 synthetic
 * dataset, U0-3) — deterministic, computed client-side via this controller;
 * the A4 decision descopes any live embedded demo org. Views stay
 * render-only.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type {
  AlertRule,
  Series,
  UptimeDay,
} from "@/models";
import type { IncidentHistoryUpdate } from "@/components/ui/IncidentHistoryEntry";
import { track, usePageView } from "./use-analytics";
import { githubRepo } from "@/models/repositories";
import { buildTimeseries, type OutageWindow, type ParsedQuery } from "@/mocks/series";
import { monitorHistory } from "@/mocks/uptime-data";
import { HOUR, MINUTE, hashSeed, mulberry32 } from "@/mocks/util";
import type { Monitor } from "@/models";

/* ------------------------------------------------------------------ */
/* Demo dataset (deterministic, from the §8.3 synthetic generators)     */
/* ------------------------------------------------------------------ */

const DEMO_STEP_MS = 5 * MINUTE;

export interface UptimeDemo {
  name: string;
  days: UptimeDay[];
  uptimePct: number;
  p95Ms: number;
}

export interface StatusRowDemo {
  name: string;
  days: UptimeDay[];
  uptimePct: number;
}

export interface HomeDemoData {
  /** Hero + demo-band panel: p50/p95/p99 latency, api-common, last 4h. */
  latencySeries: Series[];
  latencyQuery: string;
  heartbeat: UptimeDemo;
  heartbeatAllUp: UptimeDemo;
  availabilitySparkline: number[];
  latencySparkline: number[];
  visitorsSparkline: number[];
  lcpSparkline: number[];
  alertRule: AlertRule;
  incidentUpdate: IncidentHistoryUpdate;
  statusRows: StatusRowDemo[];
  /** RFC3339 — 2 minutes ago, for the "Last updated 2m ago" embeds. */
  statusUpdatedAt: string;
}

function demoMonitor(id: string, name: string): Monitor {
  return {
    id,
    name,
    target: "https://api.cuesoft.io/health",
    type: "api",
    active: true,
    status: "up",
    muted: false,
    interval_seconds: 60,
    timeout_seconds: 10,
    failure_threshold: 2,
    consecutive_failures: 0,
    last_checked_at: null,
    last_response_time_ms: null,
    last_status_code: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function meanUptime(days: UptimeDay[]): number {
  const vals = days.map((d) => d.uptime_pct).filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

function sparkline(key: string, n: number, base: number, amp: number): number[] {
  const r = mulberry32(hashSeed(key));
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = base + (r() * 2 - 1) * amp + Math.sin(i / 3) * amp * 0.6;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** Pure builder — exported for unit tests (deterministic for a given now). */
export function buildHomeDemoData(now: number): HomeDemoData {
  const snapped = now - (now % DEMO_STEP_MS);
  // a brief latency incident 2h ago on the demo service — honest p95
  // shapes per design.md §8.3 (the 12-minute window keeps the spike a
  // peak, not a plateau: the generator ramps over 5m on each side)
  const outage: OutageWindow = {
    start: snapped - 126 * MINUTE,
    end: snapped - 114 * MINUTE,
    services: ["api-common"],
  };
  const parsed: ParsedQuery = {
    metric: "trace.http.request.duration_ms",
    filters: { service: "api-common" },
    negations: {},
    text: [],
    agg: [{ fn: "p50" }, { fn: "p95" }, { fn: "p99" }],
    groupBy: [],
  };
  const ts = buildTimeseries(parsed, snapped - 4 * HOUR, snapped, outage, DEMO_STEP_MS);
  const names = ["p50", "p95", "p99"];
  const latencySeries = ts.series.map((s, i) => ({ ...s, name: names[i] ?? s.name }));

  // 90-day heartbeat with the INC-41 dent (mon_homepage path in the seed);
  // the random sub-10-minute blips are cleared so the strip reads like the
  // Figma hero — green with one honest dent (the ≥20m INC-41 outage stays)
  const heartbeatDays = monitorHistory(
    demoMonitor("mon_homepage", "api.cuesoft.io heartbeat"),
    snapped,
    outage,
  ).days.map((d) =>
    d.uptime_pct !== null && d.down_minutes > 0 && d.down_minutes < 20
      ? { ...d, uptime_pct: 100, down_minutes: 0 }
      : d,
  );
  const heartbeat: UptimeDemo = {
    name: "api.cuesoft.io heartbeat",
    days: heartbeatDays,
    uptimePct: meanUptime(heartbeatDays),
    p95Ms: 142,
  };

  // all-up variant for the demo band (§8.2 UptimeCard all-up)
  const allUpDays: UptimeDay[] = heartbeatDays.map((d) => ({
    date: d.date,
    uptime_pct: 100,
    down_minutes: 0,
  }));
  const heartbeatAllUp: UptimeDemo = {
    name: "api.cuesoft.io heartbeat",
    days: allUpDays,
    uptimePct: 100,
    p95Ms: 96,
  };

  const p95Tail = latencySeries[1].points.slice(-24).map((p) => p.value ?? 0);

  const statusDays = (blipDay: number, blipPct: number): UptimeDay[] =>
    allUpDays.map((d, i) => (i === blipDay ? { ...d, uptime_pct: blipPct, down_minutes: 8 } : d));
  const apiDays = statusDays(31, 99.3);
  const dashDays = statusDays(57, 98.9);

  return {
    latencySeries,
    latencyQuery: "p95:trace.http.request{env:prod} by service",
    heartbeat,
    heartbeatAllUp,
    availabilitySparkline: sparkline("home:availability", 24, 99.95, 0.04),
    latencySparkline: p95Tail,
    visitorsSparkline: sparkline("home:visitors", 24, 48, 6),
    lcpSparkline: sparkline("home:lcp", 24, 2.4, 0.3),
    alertRule: {
      id: "rule_demo_home",
      org_id: "org_upstat",
      name: "Error log spike",
      signal: "log",
      query: { v: 1, filters: { op: "and", terms: [] } },
      query_string: 'logs("status:error service:web").rollup(count, 5m)',
      thresholds: { warn: null, crit: 50, window: "5m" },
      notify: { channel_ids: [], cooldown_minutes: 0, renotify_minutes: 30, mute_windows: [] },
      state: "alert",
      last_triggered_at: null,
    },
    incidentUpdate: {
      ts: "2026-07-16T13:21:00Z",
      phase: "monitoring",
      body: "A fix has been deployed; monitoring recovery.",
    },
    statusRows: [
      { name: "API", days: apiDays, uptimePct: meanUptime(apiDays) },
      { name: "Dashboard", days: dashDays, uptimePct: meanUptime(dashDays) },
    ],
    // real now (not the 5m snap) — the relative label reads "2m ago" exactly
    statusUpdatedAt: new Date(now - 2 * MINUTE).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

/**
 * Pinned demo epoch for the FIRST render. The home page is statically
 * prerendered at build time — seeding the demo with `Date.now()` bakes
 * build-time chart axis labels into the HTML, and hydration (a different
 * 5m bucket) then throws React #418 (text mismatch). First render is
 * deterministic on both sides; a post-mount effect rebuilds with real now.
 */
const DEMO_EPOCH_MS = Date.parse("2026-07-18T09:00:00Z");

export function useHomeDemoData(): HomeDemoData {
  const [data, setData] = useState(() => buildHomeDemoData(DEMO_EPOCH_MS));
  // real clock after hydration — "Last updated 2m ago" stays honest.
  // Deferred a tick (use-request pattern): setState stays out of the
  // synchronous effect body.
  useEffect(() => {
    const t = window.setTimeout(() => setData(buildHomeDemoData(Date.now())), 0);
    return () => window.clearTimeout(t);
  }, []);
  return data;
}

/* ------------------------------------------------------------------ */
/* Hero crosshair loop (A2 — 8s loop over the demo panel)              */
/* ------------------------------------------------------------------ */

export function useCrosshairLoop(
  periodMs = 8000,
  /** Quantization steps — the panel's point count, so state only changes
   *  when the crosshair moves a bucket (a 60fps setState stream starves
   *  React's navigation transitions). */
  steps = 48,
  active = true,
): number | null {
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const tick = (t: number) => {
      if (!document.hidden) {
        const frac = ((t - start) % periodMs) / periodMs;
        const q = Math.round(frac * steps) / steps;
        if (q !== last) {
          last = q;
          setCursor(q);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [periodMs, steps, active]);

  return cursor;
}

/* ------------------------------------------------------------------ */
/* GitHub stars (A13/A1 — runtime only, badge stays neutral otherwise)  */
/* ------------------------------------------------------------------ */

export function useGithubStars(): number | null {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void githubRepo.stars().then((n) => {
      if (!cancelled) setStars(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return stars;
}

/* ------------------------------------------------------------------ */
/* Navigation + instrumentation (api.md §3.4 registry events)          */
/* ------------------------------------------------------------------ */

export function useHomeController() {
  const router = useRouter();
  const stars = useGithubStars();
  const demo = useHomeDemoData();
  // halt the demo loop the moment a navigation starts — a running rAF
  // state loop starves the router transition
  const [navigating, setNavigating] = useState(false);
  const heroCursor = useCrosshairLoop(
    8000,
    Math.max((demo.latencySeries[0]?.points.length ?? 49) - 1, 1),
    !navigating,
  );

  // page_view — registered dogfood event, env-gated (no-op in TEST_MODE)
  usePageView("/");

  const onSignIn = useCallback(() => {
    setNavigating(true);
    router.push("/signin");
  }, [router]);

  const onTryCloud = useCallback(() => {
    track("try_cloud_click", { path: "/" });
    setNavigating(true);
    router.push("/signin");
  }, [router]);

  const onSelfHost = useCallback(() => {
    track("self_host_click", { path: "/" });
    document.getElementById("self-host")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // docs-link variant: tracks the CTA but lets the anchor navigate
  const onSelfHostDocs = useCallback(() => {
    track("self_host_click", { path: "/" });
  }, []);

  const onGithub = useCallback(() => {
    track("github_click", { path: "/" });
  }, []);

  return {
    stars,
    demo,
    heroCursor,
    onSignIn,
    onTryCloud,
    onSelfHost,
    onSelfHostDocs,
    onGithub,
  };
}
