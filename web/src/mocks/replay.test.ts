import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { replayMonitor, replayRule } from "./replay";
import { HOUR, MINUTE } from "./util";

const NOW = Date.parse("2026-07-18T12:00:00Z");

describe("replayRule (MI-9)", () => {
  const db = buildSeed(NOW);

  it("returns 24h series with bands + would-have-fired markers for the breached rule", () => {
    const rule = db.rules.find((r) => r.id === "rule_checkout_p95")!;
    const result = replayRule(rule, db.outage, NOW);
    if ("error" in result) throw new Error(result.error);

    expect(result.series.length).toBeGreaterThan(0);
    expect(result.query_string).toBe(rule.query_string);
    // the INC-42 window spikes checkout p95 ~5x — the crit band must appear
    expect(result.bands.some((b) => b.level === "crit")).toBe(true);
    expect(result.would_have_fired).toBeGreaterThan(0);
    expect(result.markers).toHaveLength(result.would_have_fired);
    // markers land inside the replayed 24h window
    for (const ts of result.markers) {
      const t = Date.parse(ts);
      expect(t).toBeGreaterThanOrEqual(NOW - 24 * HOUR);
      expect(t).toBeLessThanOrEqual(NOW);
    }
  });

  it("degates repeat firings within the cooldown window", () => {
    const rule = db.rules.find((r) => r.id === "rule_checkout_p95")!;
    const result = replayRule(rule, db.outage, NOW);
    if ("error" in result) throw new Error(result.error);
    const times = result.markers.map((ts) => Date.parse(ts));
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(
        rule.notify.cooldown_minutes * MINUTE,
      );
    }
  });

  it("propagates grammar errors as { error } (never silent-empty)", () => {
    const rule = { ...db.rules[0], query_string: "bogus_facet:x | count()" };
    const result = replayRule(rule, db.outage, NOW);
    expect(result).toHaveProperty("error");
  });
});

describe("replayMonitor (MI-9, uptime variant)", () => {
  const db = buildSeed(NOW);

  it("derives latency thresholds from the check timeout", () => {
    const monitor = db.monitors.find((m) => m.id === "mon_checkout")!;
    const result = replayMonitor(monitor, db.outage, NOW);
    expect(result.thresholds.crit).toBe(monitor.timeout_seconds * 1000 * 0.4);
    expect(result.thresholds.warn).toBe(monitor.timeout_seconds * 1000 * 0.2);
    // the seeded INC-42 latency spike would have fired the checkout check
    expect(result.would_have_fired).toBeGreaterThan(0);
  });

  it("stays quiet for a healthy check", () => {
    const monitor = db.monitors.find((m) => m.id === "mon_homepage")!;
    const result = replayMonitor(monitor, db.outage, NOW);
    expect(result.would_have_fired).toBe(0);
    expect(result.bands.filter((b) => b.level === "crit")).toHaveLength(0);
  });
});
