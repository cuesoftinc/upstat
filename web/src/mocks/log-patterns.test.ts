import { describe, expect, it } from "vitest";
import { clusterLogs, templateOf, TREND_BUCKETS } from "./log-patterns";
import { generateLogs } from "./series";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const NOW = Date.parse("2026-07-20T12:00:00Z");
const OUTAGE = {
  start: NOW - 3 * HOUR,
  end: NOW - 2 * HOUR - 15 * MINUTE,
  services: ["checkout", "api-common"],
};

describe("templateOf", () => {
  it("collapses numeric, hex and version values into <placeholders>", () => {
    expect(
      templateOf("request completed method=GET path=/v1/stats status=200"),
    ).toBe("request completed method=GET path=<path> status=<num>");
    expect(templateOf("batch flush size=48 wait_ms=150")).toBe(
      "batch flush size=<num> wait_ms=<num>",
    );
    expect(
      templateOf(
        "span exported trace_id=9f86d081884c7d659a2feaa0c55ad015 spans=6",
      ),
    ).toBe("span exported trace_id=<id> spans=<num>");
    expect(
      templateOf("deploy started service=web version=1.14.3 strategy=canary"),
    ).toBe(
      "deploy started service=<service> version=<version> strategy=canary",
    );
  });

  it("keeps literal enums literal", () => {
    expect(templateOf("grpc channel state=READY target=api-common:8080")).toBe(
      "grpc channel state=READY target=<target>",
    );
    expect(
      templateOf("widget query served dashboard=service-overview cache=hit"),
    ).toBe("widget query served dashboard=<dashboard> cache=hit");
  });
});

describe("clusterLogs", () => {
  const from = NOW - 15 * MINUTE;

  it("is deterministic — same range, same clusters", () => {
    const a = clusterLogs(from, NOW, OUTAGE);
    const b = clusterLogs(from, NOW, OUTAGE);
    expect(a).toEqual(b);
  });

  it("every generated line lands in exactly one pattern (counts add up)", () => {
    const result = clusterLogs(from, NOW, OUTAGE);
    // 15 minutes = 900 whole seconds × 3 lines/sec, no sampling
    expect(result.sampled).toBe(false);
    expect(result.total_lines).toBe(900 * 3);
    const sum = result.patterns.reduce((s, p) => s + p.count, 0);
    expect(sum).toBe(result.total_lines);
  });

  it("samples match their pattern's template and every line matches its own template", () => {
    const result = clusterLogs(from, NOW, OUTAGE);
    for (const pattern of result.patterns) {
      expect(pattern.samples.length).toBeGreaterThan(0);
      for (const sample of pattern.samples) {
        expect(templateOf(sample.message)).toBe(pattern.template);
      }
    }
    // cross-check against the stream generator (shared line source)
    const lines = generateLogs(from, NOW, OUTAGE, undefined, undefined, 200);
    const templates = new Set(result.patterns.map((p) => p.template));
    for (const line of lines) {
      expect(templates.has(templateOf(line.message))).toBe(true);
    }
  });

  it("orders by count desc and exposes a 7-bucket trend summing to the count", () => {
    const result = clusterLogs(from, NOW, OUTAGE);
    const counts = result.patterns.map((p) => p.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    for (const pattern of result.patterns) {
      expect(pattern.trend).toHaveLength(TREND_BUCKETS);
      expect(pattern.trend.reduce((s, v) => s + v, 0)).toBe(pattern.count);
    }
  });

  it("respects service/level/text filters (explorer parity)", () => {
    const errOnly = clusterLogs(from, NOW, OUTAGE, { level: "ERROR" });
    expect(errOnly.patterns.length).toBeGreaterThan(0);
    for (const pattern of errOnly.patterns) {
      expect(pattern.dominant_level).toBe("ERROR");
      for (const sample of pattern.samples) {
        expect(sample.level).toBe("ERROR");
      }
    }
    const text = clusterLogs(from, NOW, OUTAGE, { text: ["retry"] });
    for (const pattern of text.patterns) {
      expect(pattern.template.toLowerCase()).toContain("retry");
    }
  });

  it("samples wide ranges deterministically with scaled counts", () => {
    const wide = clusterLogs(NOW - 24 * HOUR, NOW, OUTAGE);
    expect(wide.sampled).toBe(true);
    // scaled totals approximate 3 lines/sec over the range
    expect(wide.total_lines).toBeGreaterThan(24 * 3600 * 2);
    expect(wide.total_lines).toBeLessThan(24 * 3600 * 4);
    expect(clusterLogs(NOW - 24 * HOUR, NOW, OUTAGE)).toEqual(wide);
  });
});
