import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { buildHomeDemoData, useHomeDemoData } from "./home";

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
    expect(demo.heartbeatAllUp.days.every((d) => d.uptime_pct === 100)).toBe(
      true,
    );
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
    expect(alertRule.thresholds).toEqual({
      warn: null,
      crit: 50,
      window: "5m",
    });
    expect(alertRule.state).toBe("alert");
  });
});

describe("useHomeDemoData hydration determinism (React #418 regression, QA 2026-07-19)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("first render is clock-independent (static prerender === hydration)", () => {
    // The home page is prerendered at BUILD time; a Date.now()-seeded first
    // render baked stale chart axis labels into the HTML and hydration threw
    // React #418. The initial state must not depend on the system clock.
    // Full fake timers: the deferred post-mount rebuild never fires, so
    // result.current IS the first-render state.
    const firstRenderAt = (epoch: string) => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.parse(epoch));
      const { result, unmount } = renderHook(() => useHomeDemoData());
      const data = result.current;
      unmount();
      vi.useRealTimers();
      return data;
    };
    const atBuildTime = firstRenderAt("2026-07-10T08:00:00Z");
    const daysLater = firstRenderAt("2026-07-19T21:42:00Z");
    expect(atBuildTime).toEqual(daysLater);
  });

  it("rebuilds with the real clock after mount (the '2m ago' label stays honest)", async () => {
    // fake only Date: the deferred rebuild still runs on real timers
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-07-19T21:42:00Z"));
    const { result } = renderHook(() => useHomeDemoData());
    await waitFor(() =>
      expect(result.current.statusUpdatedAt).toBe("2026-07-19T21:40:00Z"),
    );
  });
});
