/**
 * Synthetic telemetry generation (design.md §8.3 design-prep): realistic
 * p50/p95 shapes with a daily cycle, noise, and the INC-42 outage window.
 * Deterministic — the same query over the same range renders identically.
 */

import type {
  LogEvent,
  LogLevel,
  QueryFn,
  Series,
  TimeseriesResult,
} from "@/models";
import {
  HOUR,
  MINUTE,
  SECOND,
  hashSeed,
  iso,
  mulberry32,
  snapStepMs,
  stepLabel,
  unitFor,
} from "./util";

export const SERVICES = [
  "api-common",
  "web",
  "worker",
  "ingest-gw",
  "clickhouse",
  "status-page",
  "checkout",
] as const;

export type ServiceName = (typeof SERVICES)[number];

export interface OutageWindow {
  /** ms epoch */
  start: number;
  end: number;
  /** services implicated in INC-42 */
  services: string[];
}

/** Smooth daily load cycle in [0.55, 1.45] peaking mid-day UTC+1 (Lagos). */
function dailyCycle(tMs: number): number {
  const dayFrac = (tMs % (24 * HOUR)) / (24 * HOUR);
  return 1 + 0.45 * Math.sin((dayFrac - 0.3) * 2 * Math.PI);
}

/** Deterministic smooth-ish noise for a key at a bucket. */
function noise(key: string, bucketMs: number, amplitude: number): number {
  const r = mulberry32(hashSeed(`${key}:${bucketMs}`));
  return (r() * 2 - 1) * amplitude;
}

function inOutage(tMs: number, outage: OutageWindow, service?: string): boolean {
  if (tMs < outage.start || tMs > outage.end) return false;
  if (!service) return true;
  return outage.services.includes(service);
}

/** Base latency profile per service (ms). */
function baseLatency(service: string): { p50: number; spread: number } {
  const u = unitFor(`latency:${service}`);
  return { p50: 60 + u * 160, spread: 2.4 + u * 2 };
}

/** Base request rate per service (req/s). */
function baseRate(service: string): number {
  const u = unitFor(`rate:${service}`);
  return 8 + u * 140;
}

/**
 * Traffic dampening per environment — non-prod envs run a deterministic
 * fraction of prod load, so the `$env` template var observably changes
 * series (`env` was parsed but never consumed; PR #156 review). INC-42 is
 * a prod incident, so non-prod also skips the outage shapes.
 */
function envScale(env: string | undefined): number {
  if (!env || env === "prod") return 1;
  return 0.15 + unitFor(`env:${env}`) * 0.3; // staging-class envs ≈ 15–45%
}

/* ------------------------------------------------------------------ */
/* Deploys                                                              */
/* ------------------------------------------------------------------ */

/**
 * Deterministic per-service release schedule — continuous delivery, one
 * deploy per service every 6h at a stable per-service offset. Releases
 * surface as staged LOG lines (started → canary → full → finished over
 * ~2min) and as a short post-deploy latency/error blip on the service's
 * metrics, so the log stream visibly correlates with metric shifts
 * (realism directive 2026-07-19). Chart deploy MARKERS stay cut per
 * pages.md B1 — no deploy-events API is implied.
 */
const DEPLOY_PERIOD = 6 * HOUR;
const DEPLOY_BLIP_MS = 45 * MINUTE;
const DEPLOY_STAGE_STEP_MS = 30 * SECOND;

const DEPLOY_STAGES = [
  (s: string, v: string) => `deploy started service=${s} version=${v} strategy=canary`,
  (s: string, v: string) => `canary at 25% service=${s} version=${v} error_rate=nominal`,
  (s: string, v: string) => `canary checks passed service=${s} version=${v}`,
  (s: string, v: string) => `rollout 100% service=${s} version=${v}`,
  (s: string, v: string) => `deploy finished service=${s} version=${v} duration=120s`,
];

export function lastDeploy(service: string, tMs: number): { at: number; version: string } {
  // second-aligned offset: the log generator iterates whole seconds, so
  // deploy instants must land exactly on one (PR #166 review — a ms-precise
  // offset shifted every stage band off the generator's grid)
  const offset =
    Math.floor((unitFor(`deploy:${service}`) * DEPLOY_PERIOD) / SECOND) * SECOND;
  const n = Math.floor((tMs - offset) / DEPLOY_PERIOD);
  const at = offset + n * DEPLOY_PERIOD;
  // monotonic-looking versions: patch bumps per deploy, minor weekly
  return { at, version: `1.${14 + (Math.floor(n / 28) % 4)}.${((n % 28) + 28) % 28}` };
}

/** Rollout stage line for the second at `secMs`, or null outside windows. */
function deployStageLine(service: string, secMs: number): string | null {
  const { at, version } = lastDeploy(service, secMs + SECOND - 1);
  const since = secMs - at;
  if (since < 0 || since > DEPLOY_STAGE_STEP_MS * (DEPLOY_STAGES.length - 1)) return null;
  if (since % DEPLOY_STAGE_STEP_MS >= SECOND) return null; // band's first second only
  return DEPLOY_STAGES[Math.round(since / DEPLOY_STAGE_STEP_MS)](service, version);
}

/** 1 → just deployed, fading to 0 over the blip window (prod only). */
function deployRamp(service: string, tMs: number): number {
  const since = tMs - lastDeploy(service, tMs).at;
  if (since < 0 || since >= DEPLOY_BLIP_MS) return 0;
  return 1 - since / DEPLOY_BLIP_MS;
}

/**
 * Value generator for a (metric, fn, service) triple at a time bucket.
 * Shapes: duration metrics honor p50/p95/p99 ordering; count/rate metrics
 * follow the daily cycle; the INC-42 window spikes latency ~8x (checkout
 * p95 peaks ~2.4s — the alert-feed narrative's "p95 2,412 ms breached crit
 * 1,500 ms") and errors ~25x on the implicated services.
 */
export function metricValue(
  metric: string,
  fn: QueryFn,
  service: string,
  tMs: number,
  outage: OutageWindow,
  env?: string,
): number {
  const cycle = dailyCycle(tMs);
  const scale = envScale(env);
  // scale === 1 ⇔ prod (or no env filter) — only prod sees INC-42
  const outageHit = scale === 1 && inOutage(tMs, outage, service);
  // ramp the spike in/out over 5 minutes so charts look organic
  const ramp = outageHit
    ? Math.min(1, (tMs - outage.start) / (5 * MINUTE), (outage.end - tMs) / (5 * MINUTE))
    : 0;

  // post-deploy cold-cache blip (prod only, log-line correlated)
  const dRamp = scale === 1 ? deployRamp(service, tMs) : 0;

  if (metric.includes("duration") || metric.includes("latency")) {
    const { p50, spread } = baseLatency(service);
    const quantile =
      fn === "p99" ? spread * 2.6 : fn === "p95" ? spread : fn === "p50" || fn === "avg" ? 1 : 1;
    let v = p50 * quantile * (0.9 + 0.2 * cycle) + noise(`${metric}:${fn}:${service}`, tMs, p50 * 0.08);
    if (ramp > 0) v *= 1 + 7 * ramp; // ~8x at peak (over the 1.5s crit line)
    v *= 1 + 0.14 * dRamp;
    v *= 0.85 + 0.15 * scale; // lighter non-prod load runs a touch faster
    return Math.max(1, Math.round(v * 100) / 100);
  }

  if (metric.includes("error")) {
    let v = baseRate(service) * 0.004 * cycle + Math.abs(noise(`${metric}:${service}`, tMs, 0.2));
    if (ramp > 0) v = baseRate(service) * 0.1 * ramp; // ~25x error spike
    v *= 1 + 1.2 * dRamp;
    v *= scale;
    return Math.round(v * 1000) / 1000;
  }

  if (metric.includes("cpu")) {
    let v = 22 + 30 * (cycle - 0.55) + noise(`cpu:${service}`, tMs, 4);
    if (ramp > 0) v += 35 * ramp;
    v *= scale;
    return Math.min(99, Math.max(2, Math.round(v * 10) / 10));
  }

  if (metric.includes("queue")) {
    let v = 40 * cycle + Math.abs(noise(`queue:${service}`, tMs, 15));
    if (ramp > 0) v += 900 * ramp; // the ingest retry-storm backlog
    v *= scale;
    return Math.round(v);
  }

  // request/throughput style metrics
  let v = baseRate(service) * cycle + noise(`${metric}:${service}`, tMs, baseRate(service) * 0.06);
  if (ramp > 0 && fn !== "count") v *= 1 - 0.35 * ramp; // throughput dips during the incident
  v *= scale;
  return Math.max(0, Math.round(v * 100) / 100);
}

export interface ParsedQuery {
  metric: string;
  filters: Record<string, string>;
  negations: Record<string, string>;
  text: string[];
  agg: { fn: QueryFn; field?: string }[];
  groupBy: string[];
}

const FNS: QueryFn[] = ["count", "rate", "sum", "avg", "min", "max", "p50", "p95", "p99", "uniq"];

/**
 * Pragmatic parser over the shared grammar (query-grammar.md §1) — enough
 * for mock evaluation: `facet:value` terms, `-` negation, free text, one
 * `| fn() [, fn()] [by facets]` tail. Unknown facets error (`invalid_query`)
 * per §3 "errors, not empty results".
 */
export function parseQuery(q: string): ParsedQuery | { error: string } {
  // One pipe max (grammar §1): EVERY additional pipe is a syntax error.
  // Splitting on every pipe silently dropped everything after the second
  // one — `a ||| garbage((` parsed clean, and `a | rate() | nonsense`
  // sailed through on the first segment alone, so MI-13's syntax-error
  // state could never surface (QA 2026-07-19; PR #156 review).
  const pipeIdx = q.indexOf("|");
  if (pipeIdx !== -1 && q.indexOf("|", pipeIdx + 1) !== -1) {
    return { error: "only one | segment allowed" };
  }
  const filterPart = (pipeIdx === -1 ? q : q.slice(0, pipeIdx)).trim();
  const aggPart = pipeIdx === -1 ? "" : q.slice(pipeIdx + 1).trim();
  if (pipeIdx !== -1 && aggPart === "") {
    return { error: "aggregation expected after |" };
  }
  const parsed: ParsedQuery = {
    metric: "http.requests_total",
    filters: {},
    negations: {},
    text: [],
    agg: [],
    groupBy: [],
  };

  const KNOWN_FACETS = new Set([
    "service", "env", "host", "status", "level", "metric", "check",
  ]);

  if (filterPart) {
    for (const raw of filterPart.split(/\s+/).filter(Boolean)) {
      const negated = raw.startsWith("-");
      const term = negated ? raw.slice(1) : raw;
      const idx = term.indexOf(":");
      if (idx === -1) {
        parsed.text.push(term.replace(/^"|"$/g, ""));
        continue;
      }
      const facet = term.slice(0, idx);
      const value = term.slice(idx + 1).replace(/^"|"$/g, "");
      // Root segment before any dot — `metric.tags` roots to `metric`.
      // (@-prefixed facets are allowed wholesale by the check below.)
      const facetRoot = facet.split(".")[0];
      if (
        !KNOWN_FACETS.has(facet) &&
        !facet.startsWith("trace.") &&
        !facet.startsWith("rum.") &&
        !facet.startsWith("@") &&
        facetRoot !== "metric"
      ) {
        return { error: `unknown facet: ${facet}` };
      }
      if (facet === "metric") parsed.metric = value;
      else if (negated) parsed.negations[facet] = value;
      else parsed.filters[facet] = value;
    }
  }

  if (aggPart) {
    const byMatch = aggPart.match(/\bby\s+(.+)$/);
    if (byMatch) parsed.groupBy = byMatch[1].split(",").map((s) => s.trim());
    const fnMatches = [...aggPart.matchAll(/(\w+)\(\s*([\w.@]*)\s*\)/g)];
    for (const m of fnMatches) {
      const fn = m[1] as QueryFn;
      if (!FNS.includes(fn)) return { error: `unknown function: ${m[1]}` };
      parsed.agg.push({ fn, field: m[2] || undefined });
    }
    if (parsed.agg.length === 0) return { error: "aggregation expected after |" };
  }

  return parsed;
}

/** Evaluate a parsed query into timeseries over [from, to]. */
export function buildTimeseries(
  parsed: ParsedQuery,
  fromMs: number,
  toMs: number,
  outage: OutageWindow,
  stepOverrideMs?: number,
): TimeseriesResult {
  const stepMs = stepOverrideMs ?? snapStepMs(toMs - fromMs);
  const agg = parsed.agg.length > 0 ? parsed.agg : [{ fn: "avg" as QueryFn }];
  const env = parsed.filters.env;
  const groupServices =
    parsed.groupBy.includes("service") || !parsed.filters.service
      ? parsed.groupBy.includes("service")
        ? [...SERVICES]
        : [parsed.filters.service ?? "api-common"]
      : [parsed.filters.service];

  const series: Series[] = [];
  for (const { fn } of agg) {
    for (const service of groupServices) {
      if (parsed.negations.service === service) continue;
      const points = [];
      for (let t = fromMs; t <= toMs; t += stepMs) {
        points.push({
          ts: iso(t),
          value: metricValue(parsed.metric, fn, service, t, outage, env),
        });
      }
      const name =
        groupServices.length > 1
          ? `${fn}(${parsed.metric}) service:${service}`
          : `${fn}(${parsed.metric})`;
      series.push({ name, tags: env ? { service, env } : { service }, points });
    }
  }

  return { kind: "timeseries", series, step: stepLabel(stepMs) };
}

/* ------------------------------------------------------------------ */
/* Logs                                                                 */
/* ------------------------------------------------------------------ */

const LOG_TEMPLATES: Record<LogLevel, string[]> = {
  INFO: [
    "request completed method=GET path=/v1/stats status=200",
    "request completed method=POST path=/v1/events status=202",
    "check executed monitor=homepage result=up",
    "rollup bucket sealed period=hour rows=1284",
    "session refreshed provider=google.com",
    "widget query served dashboard=service-overview cache=hit",
  ],
  DEBUG: [
    "resolving series hash metric=http.request.duration_ms tags=3",
    "facet index refresh service catalog entries=7",
    "grpc channel state=READY target=api-common:8080",
    "batch flush size=48 wait_ms=150",
  ],
  WARN: [
    "slow query detected duration_ms=1840 store=clickhouse",
    "retry scheduled attempt=2 backoff_ms=400 target=ingest-gw",
    "rate limit approaching property=pk_live_upstat used=91%",
    "check latency above baseline monitor=checkout-flow p95_ms=1920",
  ],
  ERROR: [
    "insert failed table=metrics_points err=queue_full retries_exhausted",
    "request failed method=POST path=/v1/events status=503 err=upstream_timeout",
    "dispatch failed channel=webhook attempt=3 err=connection_refused",
    "check failed monitor=checkout-flow status=503 timeout=false",
  ],
  TRACE: [
    // `trace_id=…` is interpolated with the LINE's own trace id at
    // generation time (PR #166 review — a hardcoded hero id here clashed
    // with the generated per-line id and leaked outside the hero window)
    "span exported trace_id={trace_id} spans=6",
    "otlp frame decoded size=2.1kb",
  ],
};

const HOSTS = ["gcp-lagos-1", "gcp-lagos-2", "gcp-fra-1"];

function levelFor(u: number, outageHit: boolean): LogLevel {
  if (outageHit) {
    if (u < 0.45) return "ERROR";
    if (u < 0.7) return "WARN";
    return "INFO";
  }
  if (u < 0.62) return "INFO";
  if (u < 0.8) return "DEBUG";
  if (u < 0.9) return "WARN";
  if (u < 0.97) return "ERROR";
  return "TRACE";
}

/** Hero-trace correlation window (log ↔ trace ↔ span coherence). */
export interface HeroTraceWindow {
  id: string;
  startMs: number;
  durationMs: number;
  services: string[];
}

/** Deterministic 32-hex trace id for a log line (plausible variety). */
function traceIdHex(key: string): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += (hashSeed(`${key}:${i}`) >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

/**
 * Deterministic log stream: ~3 lines/sec across services. `beforeMs`
 * exclusive upper bound; returns newest-first. Release events surface as
 * "deploy finished" INFO lines at each service's deploy second; every
 * line's `version` attr is the service's CURRENT version (bumps at the
 * deploy, matching the metric blip). Trace ids are per-line deterministic
 * hexes — only lines inside the hero-trace window on its services carry
 * the hero trace id (the seeded 9f86d081… id previously rode ~30% of ALL
 * lines; realism fix 2026-07-19).
 */
export function generateLogs(
  fromMs: number,
  beforeMs: number,
  outage: OutageWindow,
  filterService?: string,
  filterLevel?: string,
  limit = 100,
  hero?: HeroTraceWindow,
): LogEvent[] {
  const events: LogEvent[] = [];
  const startSec = Math.floor(beforeMs / SECOND) - 1;
  const endSec = Math.floor(fromMs / SECOND);
  for (let sec = startSec; sec >= endSec && events.length < limit; sec--) {
    const secMs = sec * SECOND;
    // rollout stage lines landing in this second (usually none)
    const rollouts = SERVICES.map((s) => ({
      service: s as string,
      line: deployStageLine(s, secMs),
    })).filter((x): x is { service: string; line: string } => x.line !== null);
    const perSecond = 3;
    for (let slot = perSecond - 1; slot >= 0 && events.length < limit; slot--) {
      const key = `log:${sec}:${slot}`;
      const r = mulberry32(hashSeed(key));
      // slot-banded offsets keep newest-first ordering strict within a second
      const tMs = secMs + slot * 300 + Math.floor(r() * 250);
      const outageHit = tMs >= outage.start && tMs <= outage.end;
      const rollout = slot === 0 ? rollouts[0] : undefined;
      // during the outage, bias lines toward the implicated services
      const service = rollout
        ? rollout.service
        : outageHit && r() < 0.5
          ? outage.services[Math.floor(r() * outage.services.length)]
          : SERVICES[Math.floor(r() * SERVICES.length)];
      const level = rollout
        ? "INFO"
        : levelFor(r(), outageHit && outage.services.includes(service));
      if (filterService && service !== filterService) continue;
      if (filterLevel && level !== filterLevel.toUpperCase()) continue;
      const deploy = lastDeploy(service, tMs);
      const templates = LOG_TEMPLATES[level];
      const message = rollout
        ? rollout.line
        : templates[Math.floor(r() * templates.length)];
      const heroHit =
        hero !== undefined &&
        tMs >= hero.startMs - 1_500 &&
        tMs <= hero.startMs + hero.durationMs + 1_500 &&
        hero.services.includes(service);
      // the line's trace id: hero window → hero id; else a per-line hex on
      // ~25% of lines — and always on messages that print a trace_id
      let traceId = heroHit
        ? hero.id
        : r() < 0.25
          ? traceIdHex(key)
          : undefined;
      let finalMessage = message;
      if (finalMessage.includes("{trace_id}")) {
        traceId ??= traceIdHex(key);
        finalMessage = finalMessage.replace("{trace_id}", traceId);
      }
      events.push({
        id: `log_${sec}_${slot}`,
        ts: iso(tMs),
        service,
        level,
        host: HOSTS[Math.floor(r() * HOSTS.length)],
        message: finalMessage,
        attrs: {
          env: "prod",
          version: deploy.version,
          ...(level === "ERROR" ? { "error.kind": "upstream" } : {}),
        },
        ...(traceId ? { trace_id: traceId } : {}),
      });
    }
  }
  return events;
}

/** Level-stacked histogram over a range (LogHistogram header, pages.md B4). */
export function logHistogram(
  fromMs: number,
  toMs: number,
  outage: OutageWindow,
): { ts: string; counts: Record<LogLevel, number> }[] {
  const stepMs = snapStepMs(toMs - fromMs);
  const buckets: { ts: string; counts: Record<LogLevel, number> }[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const outageHit = t >= outage.start && t <= outage.end;
    const scale = (stepMs / SECOND) * 3;
    const r = mulberry32(hashSeed(`hist:${t}`));
    const errShare = outageHit ? 0.32 : 0.05;
    const warnShare = outageHit ? 0.22 : 0.09;
    buckets.push({
      ts: iso(t),
      counts: {
        INFO: Math.round(scale * (0.62 - errShare / 2) * (0.9 + r() * 0.2)),
        DEBUG: Math.round(scale * 0.16 * (0.9 + r() * 0.2)),
        WARN: Math.round(scale * warnShare * (0.9 + r() * 0.2)),
        ERROR: Math.round(scale * errShare * (0.9 + r() * 0.2)),
        TRACE: Math.round(scale * 0.02 * (0.9 + r() * 0.2)),
      },
    });
  }
  return buckets;
}
