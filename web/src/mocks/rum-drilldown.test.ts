import { describe, expect, it } from "vitest";
import {
  buildRumDrilldown,
  CONVERSION_EVENT,
  RETENTION_COHORTS,
  RETENTION_WEEKS,
  retentionPct,
  weekStartMs,
} from "./rum-drilldown";
import { rumSummary } from "./rum-data";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-07-20T12:00:00Z");
const FROM = NOW - 4 * HOUR;

describe("buildRumDrilldown — funnel", () => {
  const result = buildRumDrilldown(FROM, NOW, NOW);

  it("is deterministic", () => {
    expect(buildRumDrilldown(FROM, NOW, NOW)).toEqual(result);
  });

  it("page views and sessions are the B6 summary's own numbers", () => {
    const summary = rumSummary(FROM, NOW);
    const [views, sessions] = result.funnel.stages;
    expect(views.count).toBe(summary.page_views);
    expect(sessions.count).toBe(summary.visits);
  });

  it("stages strictly narrow with correct share-of-previous math", () => {
    const [views, sessions, conversions] = result.funnel.stages;
    expect(views.count).toBeGreaterThan(sessions.count);
    expect(sessions.count).toBeGreaterThan(conversions.count);
    expect(views.pct_of_previous).toBe(100);
    expect(sessions.pct_of_previous).toBe(
      Math.round((sessions.count / views.count) * 1000) / 10,
    );
    expect(conversions.pct_of_previous).toBe(
      Math.round((conversions.count / sessions.count) * 1000) / 10,
    );
    // signup conversions run ~9–13% of sessions by construction
    expect(conversions.pct_of_previous).toBeGreaterThan(5);
    expect(conversions.pct_of_previous).toBeLessThan(20);
  });

  it("names the conversion definition (labeled honestly in-page)", () => {
    expect(result.funnel.conversion_event).toBe(CONVERSION_EVENT);
    expect(result.funnel.stages[2].label).toBe("Conversions — signup");
  });
});

describe("buildRumDrilldown — weekly cohort retention", () => {
  const result = buildRumDrilldown(FROM, NOW, NOW);
  const { cohorts, weeks } = result.retention;

  it("grids the last 8 ISO weeks × wk 0–6", () => {
    expect(weeks).toBe(RETENTION_WEEKS);
    expect(cohorts).toHaveLength(RETENTION_COHORTS);
    for (const cohort of cohorts) {
      expect(cohort.values).toHaveLength(RETENTION_WEEKS);
      // Monday-aligned cohort starts
      expect(new Date(cohort.start).getUTCDay()).toBe(1);
    }
    // newest cohort = the Monday of the range end's week
    expect(Date.parse(cohorts[cohorts.length - 1].start)).toBe(
      weekStartMs(NOW),
    );
  });

  it("wk 0 = 100% and retention never increases week over week", () => {
    for (const cohort of cohorts) {
      expect(cohort.values[0]).toBe(100);
      const observed = cohort.values.filter((v) => v > 0);
      for (let i = 1; i < observed.length; i++) {
        expect(observed[i]).toBeLessThanOrEqual(observed[i - 1]);
      }
    }
  });

  it("weeks that have not happened yet report 0", () => {
    const newest = cohorts[cohorts.length - 1];
    const start = Date.parse(newest.start);
    for (let w = 0; w < RETENTION_WEEKS; w++) {
      if (start + w * 7 * DAY > NOW) expect(newest.values[w]).toBe(0);
      else expect(newest.values[w]).toBeGreaterThan(0);
    }
    // the oldest cohort has lived all 7 weeks — fully observed
    expect(cohorts[0].values.every((v) => v > 0)).toBe(true);
  });

  it("retentionPct is deterministic per (cohort, week)", () => {
    const start = weekStartMs(NOW) - 5 * 7 * DAY;
    expect(retentionPct(start, 3)).toBe(retentionPct(start, 3));
  });
});
