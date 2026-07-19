/** RUM aggregates — deterministic, honoring analytics-math.md honesty rules. */

import type { RumSummary, RumVitals } from "@/models";
import { DAY, HOUR, MINUTE, hashSeed, iso, mulberry32, unitFor } from "./util";

const TOP_PAGES = [
  "/",
  "/pricing",
  "/docs",
  "/blog/cookieless-analytics",
  "/changelog",
];
const REFERRERS = [
  "google.com",
  "github.com",
  "news.ycombinator.com",
  "x.com",
  "duckduckgo.com",
];
const COUNTRIES = ["NG", "US", "GB", "DE", "IN"];

/**
 * Bucket width by range. Short ranges get 5m buckets — day/hour-only
 * bucketing rendered the default 1h view as ONE bar (and a one-column
 * vitals heatmap) on /dashboard/rum (QA 2026-07-19).
 */
export function rumBucketMs(rangeMs: number): number {
  if (rangeMs > 2 * DAY) return DAY;
  if (rangeMs > 6 * HOUR) return HOUR;
  return 5 * MINUTE;
}

/**
 * Exact uniques for the UTC day containing `tMs` — the day-rollup value
 * (analytics-math.md §2), independent of the presentation bucket width.
 * Same recipe as a DAY-bucket series bucket, so day-aligned series agree.
 */
function utcDayUniques(tMs: number): number {
  const dayStart = tMs - (tMs % DAY);
  const r = mulberry32(hashSeed(`rum:${dayStart}`));
  const count = Math.round(5200 * (0.7 + r() * 0.6));
  return Math.round(count * (0.55 + r() * 0.15));
}

export function rumSummary(fromMs: number, toMs: number): RumSummary {
  const bucketMs = rumBucketMs(toMs - fromMs);
  const series: RumSummary["series"] = [];
  let pageViews = 0;

  for (let t = fromMs; t < toMs; t += bucketMs) {
    const r = mulberry32(hashSeed(`rum:${t}`));
    const base = bucketMs === DAY ? 5200 : bucketMs === HOUR ? 240 : 20;
    const count = Math.round(base * (0.7 + r() * 0.6));
    const uniques = Math.round(count * (0.55 + r() * 0.15));
    series.push({ bucket: iso(t), count, uniques });
    pageViews += count;
  }

  // §4 honesty: "visitors · daily avg" averages EXACT per-UTC-day uniques.
  // Averaging presentation buckets tied the stat to bucket width — the 5m
  // buckets cut it ~12x while page views held steady (PR #156 review).
  let dayUniquesSum = 0;
  let dayCount = 0;
  for (let d = fromMs - (fromMs % DAY); d < toMs; d += DAY) {
    dayUniquesSum += utcDayUniques(d);
    dayCount++;
  }

  const visits = Math.round(pageViews / 2.6);
  const bounceVisits = Math.round(visits * 0.42);

  return {
    page_views: pageViews,
    visits,
    bounce_rate:
      visits === 0 ? null : Math.round((bounceVisits / visits) * 1000) / 1000,
    avg_visit_seconds: visits - bounceVisits === 0 ? null : 184,
    uniques_daily_avg:
      dayCount === 0 ? 0 : Math.round(dayUniquesSum / dayCount),
    uniques_additive: false,
    series,
    top_pages: TOP_PAGES.map((value, i) => ({
      value,
      count: Math.round(pageViews * [0.34, 0.21, 0.17, 0.09, 0.05][i]),
    })),
    top_referrers: REFERRERS.map((value, i) => ({
      value,
      count: Math.round(visits * [0.31, 0.24, 0.12, 0.08, 0.04][i]),
    })),
    devices: [
      { value: "desktop", count: Math.round(visits * 0.58) },
      { value: "mobile", count: Math.round(visits * 0.36) },
      { value: "tablet", count: Math.round(visits * 0.06) },
    ],
    countries: COUNTRIES.map((value, i) => ({
      value,
      count: Math.round(visits * [0.38, 0.22, 0.11, 0.08, 0.07][i]),
    })),
  };
}

export function rumVitals(fromMs: number, toMs: number): RumVitals {
  const bucketMs = rumBucketMs(toMs - fromMs);
  const series: RumVitals["series"] = [];
  for (let t = fromMs; t < toMs; t += bucketMs) {
    const u = unitFor(`vitals:${t}`);
    series.push({
      bucket: iso(t),
      lcp_ms: Math.round(1900 + u * 900),
      cls: Math.round((0.04 + u * 0.06) * 1000) / 1000,
      inp_ms: Math.round(140 + u * 120),
    });
  }
  return {
    lcp_ms: { p50: 1740, p75: 2380, p95: 4120 },
    cls: { p50: 0.03, p75: 0.07, p95: 0.19 },
    inp_ms: { p50: 128, p75: 208, p95: 460 },
    series,
  };
}
