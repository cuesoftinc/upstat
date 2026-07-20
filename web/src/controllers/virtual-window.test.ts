import { describe, expect, it } from "vitest";
import { computeVirtualWindow } from "./virtual-window";

const BASE = {
  count: 10_000,
  rowHeight: 29,
  viewportHeight: 580, // 20 rows
  extras: [],
  overscan: 20,
};

describe("computeVirtualWindow (B4 virtualized log list)", () => {
  it("renders a bounded slice of a 10k list", () => {
    const win = computeVirtualWindow({ ...BASE, scrollTop: 0 });
    expect(win.start).toBe(0);
    expect(win.end).toBe(41); // 20 visible + 1 + 20 overscan
    expect(win.end - win.start).toBeLessThan(100);
    expect(win.padTop).toBe(0);
    expect(win.totalHeight).toBe(10_000 * 29);
    expect(win.padBottom).toBe(win.totalHeight - 41 * 29);
  });

  it("windows around the scroll offset with spacers preserving scrollHeight", () => {
    const win = computeVirtualWindow({ ...BASE, scrollTop: 5_000 * 29 });
    expect(win.start).toBe(4_980);
    expect(win.end).toBe(5_041);
    expect(win.padTop).toBe(4_980 * 29);
    // spacers + rendered slice always reconstruct the full content height
    expect(win.padTop + (win.end - win.start) * 29 + win.padBottom).toBe(
      win.totalHeight,
    );
  });

  it("clamps at the list end (MI-4 tail pin scrolls to the true bottom)", () => {
    const totalHeight = 10_000 * 29;
    const win = computeVirtualWindow({
      ...BASE,
      scrollTop: totalHeight - 580,
    });
    expect(win.end).toBe(10_000);
    expect(win.padBottom).toBe(0);
    expect(win.start).toBeGreaterThan(9_950);
  });

  it("accounts for MI-5 expanded rows above and inside the viewport", () => {
    const extras = [{ index: 10, extra: 200 }];
    // scrolled past the expanded row: offsets below it shift by its extra
    const below = computeVirtualWindow({
      ...BASE,
      scrollTop: 100 * 29 + 200,
      extras,
    });
    expect(below.start).toBe(80);
    expect(below.totalHeight).toBe(10_000 * 29 + 200);
    expect(below.padTop).toBe(80 * 29 + 200);

    // an offset landing INSIDE the expanded row resolves to that row
    const inside = computeVirtualWindow({
      ...BASE,
      overscan: 0,
      scrollTop: 10 * 29 + 100,
      extras,
    });
    expect(inside.start).toBe(10);
  });

  it("ignores stale extras beyond the current count and handles empty lists", () => {
    const win = computeVirtualWindow({
      ...BASE,
      count: 5,
      scrollTop: 0,
      extras: [{ index: 99, extra: 500 }],
    });
    expect(win.totalHeight).toBe(5 * 29);
    expect(computeVirtualWindow({ ...BASE, count: 0, scrollTop: 0 })).toEqual({
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
      totalHeight: 0,
    });
  });
});
