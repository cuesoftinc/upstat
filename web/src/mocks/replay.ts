/**
 * MI-9 test replay — re-evaluate a rule (or an uptime monitor) over the
 * last 24h against its thresholds: trigger bands (warn/crit) + the
 * would-have-fired markers, cooldown-degated.
 */

import type { AlertRule, AlertThresholds, Monitor, RuleTestResult } from "@/models";
import { buildTimeseries, parseQuery, type OutageWindow, type ParsedQuery } from "./series";
import { HOUR, MINUTE, iso } from "./util";

const REPLAY_STEP_MS = 5 * MINUTE;
const REPLAY_RANGE_MS = 24 * HOUR;

function evaluate(
  parsed: ParsedQuery,
  thresholds: AlertThresholds,
  cooldownMinutes: number,
  outage: OutageWindow,
  now: number,
): RuleTestResult {
  const from = now - REPLAY_RANGE_MS;
  const result = buildTimeseries(parsed, from, now, outage, REPLAY_STEP_MS);
  const points = result.series[0]?.points ?? [];

  const bands: RuleTestResult["bands"] = [];
  const markers: string[] = [];
  let open: { level: "warn" | "crit"; from: string } | null = null;
  let lastFiredMs = -Infinity;

  for (const p of points) {
    const v = p.value;
    const level: "warn" | "crit" | null =
      v === null
        ? null
        : v >= thresholds.crit
          ? "crit"
          : thresholds.warn !== null && v >= thresholds.warn
            ? "warn"
            : null;

    if (open && (level === null || level !== open.level)) {
      bands.push({ level: open.level, from: open.from, to: p.ts });
      open = null;
    }
    if (level !== null && !open) {
      open = { level, from: p.ts };
      if (level === "crit") {
        const tMs = Date.parse(p.ts);
        if (tMs - lastFiredMs >= cooldownMinutes * MINUTE) {
          markers.push(p.ts);
          lastFiredMs = tMs;
        }
      }
    }
  }
  if (open) bands.push({ level: open.level, from: open.from, to: iso(now) });

  return {
    query_string: "",
    thresholds,
    series: result.series,
    step: result.step,
    bands,
    markers,
    would_have_fired: markers.length,
  };
}

/** Replay an alert rule's own query against its thresholds. */
export function replayRule(
  rule: AlertRule,
  outage: OutageWindow,
  now = Date.now(),
): RuleTestResult | { error: string } {
  const parsed = parseQuery(rule.query_string);
  if ("error" in parsed) return parsed;
  return {
    ...evaluate(parsed, rule.thresholds, rule.notify.cooldown_minutes, outage, now),
    query_string: rule.query_string,
  };
}

/**
 * Uptime-monitor variant: response time replayed against latency
 * thresholds derived from the check timeout (crit = timeout, warn = 60%).
 */
export function replayMonitor(
  monitor: Monitor,
  outage: OutageWindow,
  now = Date.now(),
): RuleTestResult {
  // Degraded-latency heuristics well under the hard timeout: a check that
  // takes 40% of its timeout budget is already in trouble (keeps the
  // seeded INC-42 spike visible on the checkout monitor's replay).
  const timeoutMs = monitor.timeout_seconds * 1000;
  const thresholds: AlertThresholds = {
    warn: Math.round(timeoutMs * 0.2),
    crit: Math.round(timeoutMs * 0.4),
    window: `${monitor.failure_threshold} checks`,
  };
  const parsed: ParsedQuery = {
    metric: "http.request.duration_ms",
    // checkout's target maps onto the seeded outage service so the seeded
    // narrative (INC-42) shows a band on the checkout monitor's replay
    filters: { service: monitor.name.toLowerCase().includes("checkout") ? "checkout" : "web" },
    negations: {},
    text: [],
    agg: [{ fn: "p95" }],
    groupBy: [],
  };
  const result = evaluate(parsed, thresholds, 5, outage, now);
  return {
    ...result,
    query_string: `check:${monitor.name} | p95(response_time_ms)`,
  };
}
