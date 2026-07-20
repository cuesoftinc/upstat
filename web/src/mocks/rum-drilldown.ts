/**
 * B6 RUM drill-down (U6-2, pages.md B6 [Designed 2026-07-20]) — funnel and
 * weekly-cohort retention, deterministic and coherent with rum-data.ts:
 * the funnel's page views/sessions are the SAME rumSummary math the B6
 * overview shows; conversions count the registered signup event
 * (`auth_signin_completed`, api.md §3.4 upstat row).
 */

import type { RumDrilldown } from "@/models";
import { rumSummary } from "./rum-data";
import { DAY, hashSeed, iso, mulberry32, unitFor } from "./util";

export const CONVERSION_EVENT = "auth_signin_completed";
export const RETENTION_WEEKS = 7; // wk 0–6
export const RETENTION_COHORTS = 8;

const WEEK = 7 * DAY;

/**
 * Deterministic signup-conversion count for a bucket series — a stable
 * ~9–13% of the bucket's sessions (visits), keyed per bucket so the same
 * range always reports the same funnel.
 */
function conversionsFor(series: { bucket: string; count: number }[]): number {
  let total = 0;
  for (const bucket of series) {
    const sessions = Math.round(bucket.count / 2.6); // rum-data.ts visits ratio
    const r = mulberry32(hashSeed(`conv:${bucket.bucket}`));
    total += Math.round(sessions * (0.09 + r() * 0.04));
  }
  return total;
}

/** Monday 00:00 UTC on/before `tMs` (cohort weeks are ISO weeks). */
export function weekStartMs(tMs: number): number {
  const date = new Date(tMs);
  const day = (date.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - day,
  );
}

/**
 * Retention % for a cohort at week offset — wk 0 = 100%, then a
 * multiplicative decay (~35–45% wk 1, flattening) with per-cell noise.
 */
export function retentionPct(cohortStartMs: number, week: number): number {
  if (week === 0) return 100;
  let pct = 100;
  for (let w = 1; w <= week; w++) {
    const keep =
      w === 1
        ? 0.34 + unitFor(`cohort:${cohortStartMs}:1`) * 0.12
        : 0.62 + unitFor(`cohort:${cohortStartMs}:${w}`) * 0.28;
    pct *= keep;
  }
  return Math.round(pct * 10) / 10;
}

export function buildRumDrilldown(
  fromMs: number,
  toMs: number,
  now: number,
): RumDrilldown {
  const summary = rumSummary(fromMs, toMs);
  const sessions = summary.visits;
  const conversions = Math.min(conversionsFor(summary.series), sessions);

  const stages = [
    { key: "page_views", label: "Page views", count: summary.page_views },
    { key: "sessions", label: "Sessions", count: sessions },
    { key: "conversions", label: "Conversions — signup", count: conversions },
  ].map((stage, i, all) => ({
    ...stage,
    pct_of_previous:
      i === 0
        ? 100
        : all[i - 1].count === 0
          ? 0
          : Math.round((stage.count / all[i - 1].count) * 1000) / 10,
  }));

  // Weekly cohorts: the last RETENTION_COHORTS ISO weeks up to the range
  // end; week offsets that haven't happened yet report 0 (no data).
  const lastCohort = weekStartMs(toMs);
  const cohorts = Array.from({ length: RETENTION_COHORTS }, (_, i) => {
    const start = lastCohort - (RETENTION_COHORTS - 1 - i) * WEEK;
    return {
      start: iso(start),
      values: Array.from({ length: RETENTION_WEEKS }, (_, week) =>
        start + week * WEEK > now ? 0 : retentionPct(start, week),
      ),
    };
  });

  return {
    funnel: { stages, conversion_event: CONVERSION_EVENT },
    retention: { weeks: RETENTION_WEEKS, cohorts },
  };
}
