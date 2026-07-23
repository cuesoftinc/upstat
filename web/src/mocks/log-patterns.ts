/**
 * B4 log patterns (pages.md B4 [Designed 2026-07-20], OBS-012) — clusters
 * the deterministic log stream into message templates with `<placeholders>`
 * marking the clustered variables. Same-input-same-clusters: the template
 * extraction is a pure function of the seeded lines.
 */

import type {
  LogEvent,
  LogLevel,
  LogPattern,
  LogPatternsResult,
} from "@/models";
import {
  logLinesAtSecond,
  type HeroTraceWindow,
  type OutageWindow,
} from "./series";
import { SECOND } from "@/lib/format";

export const TREND_BUCKETS = 7;

/** Max seconds enumerated per query — wider ranges sample evenly and
 *  scale the counts (deterministic stride; the samples stay real lines). */
const MAX_ENUMERATED_SECONDS = 3_600;

/** Keys whose `key=value` values are variable across lines by design. */
const VARIABLE_KEYS = new Set([
  "service",
  "version",
  "monitor",
  "path",
  "target",
  "dashboard",
  "provider",
  "store",
  "channel",
  "table",
  "queue",
  "property",
  "period",
  "result",
  "err",
  "reason",
  "used",
]);

const NUM_RE = /^\d+(\.\d+)?(ms|s|kb|mb|gb|%|x)?$/i;
const HEX_RE = /^[0-9a-f]{8,}$/i;
const VERSION_RE = /^v?\d+\.\d+\.\d+$/;

function placeholderForValue(value: string): string | null {
  if (NUM_RE.test(value)) return "<num>";
  if (HEX_RE.test(value)) return "<id>";
  if (VERSION_RE.test(value)) return "<version>";
  return null;
}

/**
 * Template extraction: whitespace tokens; numeric/hex/version tokens (and
 * `key=value` values — plus values of known-variable keys) collapse into
 * `<placeholders>`; everything else stays literal.
 */
export function templateOf(message: string): string {
  return message
    .split(" ")
    .map((token) => {
      const eq = token.indexOf("=");
      if (eq > 0) {
        const key = token.slice(0, eq);
        const value = token.slice(eq + 1);
        const ph =
          placeholderForValue(value) ??
          (VARIABLE_KEYS.has(key) ? `<${key}>` : null);
        return ph ? `${key}=${ph}` : token;
      }
      return placeholderForValue(token) ?? token;
    })
    .join(" ");
}

export interface ClusterFilters {
  service?: string;
  level?: string;
  /** Free-text terms — a line must contain every term (explorer parity). */
  text?: string[];
}

interface Accumulator {
  template: string;
  count: number;
  trend: number[];
  levels: Map<LogLevel, number>;
  samples: LogEvent[];
}

/**
 * Cluster the range's lines into patterns. Deterministic: enumerates whole
 * seconds of the shared line generator; ranges wider than
 * MAX_ENUMERATED_SECONDS sample every `stride`-th second and scale counts
 * by the stride (real lines, honest totals ±sampling).
 */
export function clusterLogs(
  fromMs: number,
  toMs: number,
  outage: OutageWindow,
  filters: ClusterFilters = {},
  hero?: HeroTraceWindow,
): LogPatternsResult {
  const fromSec = Math.floor(fromMs / SECOND);
  const toSec = Math.max(Math.floor(toMs / SECOND), fromSec + 1);
  const rangeSec = toSec - fromSec;
  const stride = Math.max(1, Math.ceil(rangeSec / MAX_ENUMERATED_SECONDS));
  const bucketSec = rangeSec / TREND_BUCKETS;

  const acc = new Map<string, Accumulator>();
  const terms = (filters.text ?? []).map((t) => t.toLowerCase());
  let total = 0;

  // newest → oldest so the first samples kept per pattern are the newest
  for (let sec = toSec - 1; sec >= fromSec; sec -= stride) {
    for (const event of logLinesAtSecond(sec, outage, hero)) {
      if (filters.service && event.service !== filters.service) continue;
      if (filters.level && event.level !== filters.level.toUpperCase())
        continue;
      if (terms.length > 0) {
        const haystack = event.message.toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) continue;
      }
      const template = templateOf(event.message);
      let entry = acc.get(template);
      if (!entry) {
        entry = {
          template,
          count: 0,
          trend: Array.from({ length: TREND_BUCKETS }, () => 0),
          levels: new Map(),
          samples: [],
        };
        acc.set(template, entry);
      }
      entry.count += stride;
      total += stride;
      const bucket = Math.min(
        TREND_BUCKETS - 1,
        Math.floor((sec - fromSec) / bucketSec),
      );
      entry.trend[bucket] += stride;
      entry.levels.set(event.level, (entry.levels.get(event.level) ?? 0) + 1);
      if (entry.samples.length < 3) entry.samples.push(event);
    }
  }

  const patterns: LogPattern[] = [...acc.values()]
    .map((entry) => ({
      template: entry.template,
      count: entry.count,
      dominant_level: dominantLevel(entry.levels),
      trend: entry.trend,
      samples: entry.samples,
    }))
    .sort((a, b) => b.count - a.count || a.template.localeCompare(b.template));

  return {
    patterns,
    total_lines: total,
    bucket_ms: Math.round((rangeSec / TREND_BUCKETS) * SECOND),
    sampled: stride > 1,
  };
}

function dominantLevel(levels: Map<LogLevel, number>): LogLevel {
  let best: LogLevel = "INFO";
  let bestCount = -1;
  for (const [level, count] of levels) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}
