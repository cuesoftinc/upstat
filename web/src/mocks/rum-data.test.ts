import { describe, expect, it } from "vitest";
import { DAY, HOUR, MINUTE } from "@/lib/format";
import { rumBucketMs, rumSummary, rumVitals } from "./rum-data";

const NOW = Date.parse("2026-07-18T12:00:00Z");

describe("rum bucketing (B6)", () => {
  it("short ranges get 5m buckets — a 1h view is a real series, not one bar (QA 2026-07-19)", () => {
    expect(rumBucketMs(HOUR)).toBe(5 * MINUTE);
    expect(rumBucketMs(6 * HOUR)).toBe(5 * MINUTE);
    expect(rumBucketMs(DAY)).toBe(HOUR);
    expect(rumBucketMs(7 * DAY)).toBe(DAY);
  });

  it("1h summary and vitals series carry ~12 buckets", () => {
    const summary = rumSummary(NOW - HOUR, NOW);
    expect(summary.series.length).toBe(12);
    const vitals = rumVitals(NOW - HOUR, NOW);
    expect(vitals.series.length).toBe(12);
  });

  it("stays deterministic per bucket", () => {
    expect(rumSummary(NOW - HOUR, NOW)).toEqual(rumSummary(NOW - HOUR, NOW));
  });
});

describe("uniques_daily_avg (analytics-math.md §4, #156)", () => {
  const DAY_START = Date.parse("2026-07-18T00:00:00Z");

  it("is independent of the presentation bucket width", () => {
    // a 1h view (5m buckets) and the full-day view (1h buckets) over the
    // same UTC day must agree — averaging presentation buckets made the
    // stat track bucket width (~12x drop when buckets went 1h → 5m)
    const hour = rumSummary(NOW - HOUR, NOW);
    const day = rumSummary(DAY_START, DAY_START + DAY);
    expect(hour.uniques_daily_avg).toBe(day.uniques_daily_avg);

    // and it is a day-scale figure, not a per-bucket mean
    const bucketMean =
      hour.series.reduce((s, b) => s + b.uniques, 0) / hour.series.length;
    expect(hour.uniques_daily_avg).toBeGreaterThan(bucketMean * 12);
  });

  it("averages exact per-day uniques over multi-day ranges (never a sum)", () => {
    const d1 = rumSummary(DAY_START - DAY, DAY_START).uniques_daily_avg;
    const d2 = rumSummary(DAY_START, DAY_START + DAY).uniques_daily_avg;
    const twoDays = rumSummary(DAY_START - DAY, DAY_START + DAY);
    expect(twoDays.uniques_daily_avg).toBe(Math.round((d1 + d2) / 2));
    expect(twoDays.uniques_additive).toBe(false);
  });
});
