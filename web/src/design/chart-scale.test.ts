import { describe, expect, it } from "vitest";
import { niceScale, plotScale } from "./chart-scale";

describe("niceScale (chart y-axis, design.md §8.2 construction)", () => {
  it("reproduces the Figma master ladder (0 / 200 / 400 / 600 ms) for a 0..~520ms domain", () => {
    const scale = niceScale(0, 520 * 1.05);
    expect(scale.ticks).toEqual([0, 200, 400, 600]);
    expect(scale.domainMin).toBe(0);
    expect(scale.domainMax).toBe(600);
  });

  it("keeps a zero-based min for rate-style domains", () => {
    const scale = niceScale(0, 3_412);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.domainMin).toBe(0);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(3);
  });

  it("a tiny negative dip never drags the axis a whole step down", () => {
    const scale = niceScale(-13, 4_650);
    // bottom keeps the raw bound; first tick sits inside the domain
    expect(scale.domainMin).toBe(-13);
    expect(scale.ticks[0]).toBe(0);
  });

  it("handles degenerate and empty domains", () => {
    // lo === hi anchors at zero with a step of room
    const flat = niceScale(5, 5);
    expect(flat.domainMin).toBe(0);
    expect(flat.domainMax).toBeGreaterThanOrEqual(5);
    expect(niceScale(0, 0)).toEqual({
      ticks: [0, 1],
      domainMin: 0,
      domainMax: 1,
    });
    expect(niceScale(Number.NaN, 1).ticks).toEqual([0]);
  });

  it("never emits −0 labels", () => {
    const scale = niceScale(-1_000, 1_000);
    const zero = scale.ticks.find((t) => t === 0);
    expect(Object.is(zero, -0)).toBe(false);
  });
});

describe("plotScale (TimeseriesPanel domain rule)", () => {
  it("zero-bases positive-only series and adds 5% headroom before snapping", () => {
    const scale = plotScale([84, 142, 520.2]);
    expect(scale.domainMin).toBe(0);
    expect(scale.ticks).toEqual([0, 200, 400, 600]);
  });

  it("survives empty input", () => {
    const scale = plotScale([]);
    expect(scale.domainMin).toBe(0);
    expect(scale.domainMax).toBeGreaterThan(0);
  });

  it("spreads a flat series across a unit window", () => {
    const scale = plotScale([7, 7, 7]);
    expect(scale.domainMin).toBeLessThanOrEqual(6);
    expect(scale.domainMax).toBeGreaterThanOrEqual(8);
  });
});
