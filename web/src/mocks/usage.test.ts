import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { rumSummary } from "./rum-data";
import {
  averageLogLineBytes,
  buildUsageReport,
  monthLabel,
  monthStartMs,
  USAGE_PLAN_COPY,
} from "./usage";

// 2026-07-20 12:00 UTC — org tz Africa/Lagos (UTC+1) → local July 20 13:00
const NOW = Date.parse("2026-07-20T12:00:00Z");

describe("monthStartMs / monthLabel (org-timezone boundaries, X-10)", () => {
  it("resolves the month boundary in the org timezone, not UTC", () => {
    // Lagos midnight July 1 = 2026-06-30T23:00:00Z
    expect(monthStartMs(NOW, "Africa/Lagos")).toBe(
      Date.parse("2026-06-30T23:00:00Z"),
    );
    expect(monthStartMs(NOW, "UTC")).toBe(Date.parse("2026-07-01T00:00:00Z"));
    // 00:30 UTC on July 1 is still June 30 in New York (UTC-4)
    const early = Date.parse("2026-07-01T00:30:00Z");
    expect(monthLabel(early, "America/New_York")).toBe("June 2026");
    expect(monthLabel(NOW, "Africa/Lagos")).toBe("July 2026");
  });
});

describe("buildUsageReport (honest sums from the seed)", () => {
  const db = buildSeed(NOW);
  const report = buildUsageReport(db, NOW);

  it("is deterministic and carries the four pillar meters in order", () => {
    expect(buildUsageReport(buildSeed(NOW), NOW)).toEqual(report);
    expect(report.month_label).toBe("July 2026");
    expect(report.rows.map((r) => r.pillar)).toEqual([
      "metrics",
      "logs",
      "traces",
      "rum",
    ]);
  });

  it("metrics = Σ cardinality over the seeded metrics catalog", () => {
    const expected = db.metricCatalog.reduce((s, m) => s + m.cardinality, 0);
    const metrics = report.rows.find((r) => r.pillar === "metrics")!;
    expect(metrics.value).toBe(expected);
    expect(expected).toBe(2738); // the seeded catalog, summed by hand
  });

  it("logs = 3 lines/s × seconds MTD × measured mean line bytes", () => {
    const from = monthStartMs(NOW, db.org.timezone);
    const seconds = Math.floor((NOW - from) / 1000);
    const avg = averageLogLineBytes(db, NOW);
    expect(avg).toBeGreaterThan(100); // real serialized lines, not a guess
    const logs = report.rows.find((r) => r.pillar === "logs")!;
    expect(logs.value).toBe(Math.round(3 * seconds * avg));
    expect(logs.display).toMatch(/GB$/);
  });

  it("rum = the B6 summary's own page-view math over [month start, now]", () => {
    const from = monthStartMs(NOW, db.org.timezone);
    const rum = report.rows.find((r) => r.pillar === "rum")!;
    expect(rum.value).toBe(rumSummary(from, NOW).page_views);
  });

  it("traces meter derives from the APM req/s series (non-trivial volume)", () => {
    const traces = report.rows.find((r) => r.pillar === "traces")!;
    // ~19.5 Lagos-days of Σ-service traffic × mean span count — just assert
    // the derivation produced a plausibly large, peak-bounded figure
    expect(traces.value).toBeGreaterThan(1_000_000);
    expect(traces.value).toBeLessThanOrEqual(traces.peak);
  });

  it("display compact-scales past 1000M (audit 2026-07-20: no “5551.4M”)", () => {
    for (const row of report.rows) {
      // never a 4+ digit mantissa on the M scale — billions promote to B
      expect(row.display).not.toMatch(/\d{4,}(\.\d+)?M$/);
      if (row.value >= 1_000_000_000 && /[MB]$/.test(row.display)) {
        expect(row.display).toMatch(/B$/);
      }
    }
  });

  it("every row carries the verbatim plan copy and a usable bar scale", () => {
    for (const row of report.rows) {
      expect(row.plan).toBe("Self-host: unlimited · Cloud: announced at GA");
      expect(row.plan).toBe(USAGE_PLAN_COPY);
      expect(row.peak).toBeGreaterThan(0);
      expect(row.value / row.peak).toBeLessThanOrEqual(1);
    }
  });
});
