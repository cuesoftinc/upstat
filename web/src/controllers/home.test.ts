import { describe, expect, it } from "vitest";
import { buildHomeDemoData } from "./home";

const NOW = Date.parse("2026-07-18T12:03:21Z");

describe("home demo data (A4 — synthetic, from the §8.3 mock seeds)", () => {
  it("is deterministic for a given time (5m snap)", () => {
    const a = buildHomeDemoData(NOW);
    const b = buildHomeDemoData(NOW + 90_000); // same 5-minute bucket
    expect(a.latencySeries).toEqual(b.latencySeries);
    expect(a.heartbeat.days).toEqual(b.heartbeat.days);
  });

  it("builds honest p50/p95/p99 shapes (quantile ordering holds)", () => {
    const { latencySeries } = buildHomeDemoData(NOW);
    expect(latencySeries.map((s) => s.name)).toEqual(["p50", "p95", "p99"]);
    const [p50, p95, p99] = latencySeries;
    for (let i = 0; i < p50.points.length; i++) {
      const v50 = p50.points[i].value ?? 0;
      const v95 = p95.points[i].value ?? 0;
      const v99 = p99.points[i].value ?? 0;
      expect(v95).toBeGreaterThanOrEqual(v50);
      expect(v99).toBeGreaterThanOrEqual(v95);
    }
  });

  it("carries the 90-day strips: dented heartbeat + all-up demo variant", () => {
    const demo = buildHomeDemoData(NOW);
    expect(demo.heartbeat.days).toHaveLength(90);
    expect(demo.heartbeat.uptimePct).toBeLessThan(100);
    expect(demo.heartbeatAllUp.days.every((d) => d.uptime_pct === 100)).toBe(true);
    expect(demo.heartbeatAllUp.uptimePct).toBe(100);
  });

  it("computes status-row uptime from the strip (no invented figures)", () => {
    const demo = buildHomeDemoData(NOW);
    for (const row of demo.statusRows) {
      const mean =
        row.days.reduce((a, d) => a + (d.uptime_pct ?? 0), 0) / row.days.length;
      expect(row.uptimePct).toBeCloseTo(mean, 1);
    }
  });

  it("keeps the alert-rule demo on the documented contract shape", () => {
    const { alertRule } = buildHomeDemoData(NOW);
    expect(alertRule.signal).toBe("log");
    expect(alertRule.thresholds).toEqual({ warn: null, crit: 50, window: "5m" });
    expect(alertRule.state).toBe("alert");
  });
});
