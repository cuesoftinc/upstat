import { describe, expect, it } from "vitest";
import {
  buildTimeseries,
  generateLogs,
  parseQuery,
  type OutageWindow,
} from "./series";
import { HOUR, MINUTE } from "./util";

const NOW = Date.parse("2026-07-18T12:00:00Z");
const OUTAGE: OutageWindow = {
  start: NOW - 3 * HOUR,
  end: NOW - 2 * HOUR - 15 * MINUTE,
  services: ["checkout", "api-common"],
};

describe("parseQuery", () => {
  it("parses filters, aggregation and group-by", () => {
    const parsed = parseQuery(
      "metric:http.request.duration_ms service:web | p95() by service",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.metric).toBe("http.request.duration_ms");
    expect(parsed.filters.service).toBe("web");
    expect(parsed.agg).toEqual([{ fn: "p95", field: undefined }]);
    expect(parsed.groupBy).toEqual(["service"]);
  });

  it("rejects unknown facets (errors, not empty results — grammar §3)", () => {
    const parsed = parseQuery("serivce:web");
    expect(parsed).toHaveProperty("error");
  });

  it("rejects unknown aggregation functions", () => {
    const parsed = parseQuery("service:web | median()");
    expect(parsed).toHaveProperty("error");
  });

  it("rejects malformed pipes instead of silently succeeding (MI-13)", () => {
    // split-on-every-pipe used to drop the garbage and parse clean, so the
    // QueryBar's syntax-error state was unreachable (QA 2026-07-19)
    expect(
      parseQuery("metric:http.requests_total ||| nonsense(("),
    ).toHaveProperty("error");
    expect(parseQuery("service:web |")).toHaveProperty("error");
    expect(parseQuery("service:web | nonsense((")).toHaveProperty("error");
  });

  it("rejects EVERY additional pipe — one | segment max (grammar §1, #156)", () => {
    // `a | rate() | nonsense` used to sail through on the first segment
    // alone, silently ignoring the second pipe and trailing text
    expect(parseQuery("service:web | rate() | nonsense")).toHaveProperty(
      "error",
    );
    expect(parseQuery("service:web | rate() | sum()")).toHaveProperty("error");
    expect(parseQuery("service:web | rate() |")).toHaveProperty("error");
    // the single-pipe form still parses clean
    expect(parseQuery("service:web | rate()")).not.toHaveProperty("error");
  });

  it("accepts negation and free text", () => {
    const parsed = parseQuery("-level:debug timeout service:web");
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.negations.level).toBe("debug");
    expect(parsed.text).toContain("timeout");
  });
});

describe("buildTimeseries", () => {
  it("is deterministic and spans the requested range", () => {
    const parsed = parseQuery(
      "metric:http.request.duration_ms service:checkout | p95()",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    const a = buildTimeseries(parsed, NOW - 4 * HOUR, NOW, OUTAGE);
    const b = buildTimeseries(parsed, NOW - 4 * HOUR, NOW, OUTAGE);
    expect(a).toEqual(b);
    expect(a.series).toHaveLength(1);
    // 4h range → 5m step (range/200 snapped) → ~48 buckets
    expect(a.series[0].points.length).toBeGreaterThanOrEqual(48);
    expect(a.step).toBe("5m");
  });

  it("shows the INC-42 outage spike on implicated services", () => {
    const parsed = parseQuery(
      "metric:http.request.duration_ms service:checkout | p95()",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    const result = buildTimeseries(parsed, NOW - 6 * HOUR, NOW, OUTAGE);
    const points = result.series[0].points;
    const mid = (OUTAGE.start + OUTAGE.end) / 2;
    const during = points.filter(
      (p) => Math.abs(Date.parse(p.ts) - mid) < 20 * MINUTE,
    );
    const before = points.filter((p) => Date.parse(p.ts) < OUTAGE.start - HOUR);
    const avg = (xs: typeof points) =>
      xs.reduce((s, p) => s + (p.value ?? 0), 0) / Math.max(xs.length, 1);
    expect(avg(during)).toBeGreaterThan(avg(before) * 2.5);
  });

  it("keeps p95 above p50 (honest quantile shapes)", () => {
    const q50 = parseQuery(
      "metric:http.request.duration_ms service:web | p50()",
    );
    const q95 = parseQuery(
      "metric:http.request.duration_ms service:web | p95()",
    );
    if ("error" in q50 || "error" in q95) throw new Error("parse failed");
    const r50 = buildTimeseries(q50, NOW - 2 * HOUR, NOW, OUTAGE);
    const r95 = buildTimeseries(q95, NOW - 2 * HOUR, NOW, OUTAGE);
    for (let i = 0; i < r50.series[0].points.length; i++) {
      expect(r95.series[0].points[i].value!).toBeGreaterThan(
        r50.series[0].points[i].value!,
      );
    }
  });

  it("fans out one series per service on `by service`", () => {
    const parsed = parseQuery("metric:http.requests_total | rate() by service");
    if ("error" in parsed) throw new Error(parsed.error);
    const result = buildTimeseries(parsed, NOW - HOUR, NOW, OUTAGE);
    expect(result.series).toHaveLength(7);
  });

  it("consumes env — switching $env observably changes series, INC-42 stays prod-only (#156)", () => {
    const q = (env: string) =>
      parseQuery(
        `metric:http.errors_total service:checkout env:${env} | rate()`,
      );
    const prod = q("prod");
    const staging = q("staging");
    if ("error" in prod || "error" in staging) throw new Error("parse failed");
    const rProd = buildTimeseries(prod, NOW - 6 * HOUR, NOW, OUTAGE);
    const rStaging = buildTimeseries(staging, NOW - 6 * HOUR, NOW, OUTAGE);

    // different data, tagged with the env it was filtered to
    expect(rStaging.series[0].points).not.toEqual(rProd.series[0].points);
    expect(rStaging.series[0].tags.env).toBe("staging");

    // staging runs a deterministic fraction of prod traffic
    const total = (r: typeof rProd) =>
      r.series[0].points.reduce((s, p) => s + (p.value ?? 0), 0);
    expect(total(rStaging)).toBeLessThan(total(rProd) * 0.6);

    // the prod outage spike does not leak into staging
    const mid = (OUTAGE.start + OUTAGE.end) / 2;
    const avgWhere = (r: typeof rProd, pred: (t: number) => boolean) => {
      const xs = r.series[0].points.filter((p) => pred(Date.parse(p.ts)));
      return (
        xs.reduce((s, p) => s + (p.value ?? 0), 0) / Math.max(xs.length, 1)
      );
    };
    const during = (t: number) => Math.abs(t - mid) < 20 * MINUTE;
    const before = (t: number) => t < OUTAGE.start - HOUR;
    expect(avgWhere(rProd, during)).toBeGreaterThan(
      avgWhere(rProd, before) * 5,
    );
    expect(avgWhere(rStaging, during)).toBeLessThan(
      avgWhere(rStaging, before) * 2,
    );
  });
});

describe("generateLogs", () => {
  it("is deterministic, newest-first, and respects limits", () => {
    const a = generateLogs(
      NOW - 10 * MINUTE,
      NOW,
      OUTAGE,
      undefined,
      undefined,
      50,
    );
    const b = generateLogs(
      NOW - 10 * MINUTE,
      NOW,
      OUTAGE,
      undefined,
      undefined,
      50,
    );
    expect(a).toEqual(b);
    expect(a).toHaveLength(50);
    for (let i = 1; i < a.length; i++) {
      expect(a[i - 1].ts >= a[i].ts).toBe(true);
    }
  });

  it("filters by service and level", () => {
    const logs = generateLogs(
      NOW - 30 * MINUTE,
      NOW,
      OUTAGE,
      "checkout",
      "ERROR",
      20,
    );
    for (const line of logs) {
      expect(line.service).toBe("checkout");
      expect(line.level).toBe("ERROR");
    }
  });
});
