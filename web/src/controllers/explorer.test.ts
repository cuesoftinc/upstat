import { describe, expect, it } from "vitest";
import { joinQuery, splitQuery } from "./explorer";

describe("splitQuery / joinQuery (QueryBar mechanics)", () => {
  it("splits facet terms into pills and keeps the agg tail as text", () => {
    const { pills, text } = splitQuery(
      "metric:http.request.duration_ms service:checkout timeout | p95() by service",
    );
    expect(pills).toEqual([
      { facet: "metric", value: "http.request.duration_ms", negated: false },
      { facet: "service", value: "checkout", negated: false },
    ]);
    expect(text).toBe("timeout | p95() by service");
  });

  it("keeps negations on the pill (MI-6)", () => {
    const { pills } = splitQuery("-service:web level:ERROR");
    expect(pills).toEqual([
      { facet: "service", value: "web", negated: true },
      { facet: "level", value: "ERROR", negated: false },
    ]);
  });

  it("round-trips through joinQuery (URL/API form)", () => {
    const q = "metric:http.errors_total -service:web crash | rate() by service";
    const { pills, text } = splitQuery(q);
    expect(joinQuery(pills, text)).toBe(q);
  });

  it("handles empty query", () => {
    const { pills, text } = splitQuery("");
    expect(pills).toEqual([]);
    expect(text).toBe("");
    expect(joinQuery(pills, text)).toBe("");
  });
});
