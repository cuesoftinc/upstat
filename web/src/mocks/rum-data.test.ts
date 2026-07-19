import { describe, expect, it } from "vitest";
import { DAY, HOUR, MINUTE } from "./util";
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
