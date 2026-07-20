/**
 * Nice-number axis scale for the bespoke charts (design.md §8.2; the
 * TimeseriesPanel master's 0 / 200 ms / 400 ms / 600 ms ladder, Figma
 * 50:407): ticks step on a 1 / 2 / 2.5 / 5 × 10^k grid covering the data
 * domain. Mirrors expendit's merged `niceScale` (cross-repo chart canon).
 *
 * Bounds snap outward to a step multiple only when the dead band that
 * adds is small (≤ half a step) — a small dip below zero never pulls a
 * large axis a whole step down; the axis keeps the raw bound and the
 * first/last tick sits inside the domain instead (the series may ride
 * slightly past the outer gridline, absorbed by the plot pad).
 */

export interface ChartScale {
  /** Ascending tick values (gridline + label positions). */
  ticks: number[];
  domainMin: number;
  domainMax: number;
}

export const niceScale = (
  min: number,
  max: number,
  targetCount = 4,
): ChartScale => {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { ticks: [0], domainMin: 0, domainMax: 1 };
  }
  if (lo === hi) {
    // Degenerate domain — anchor at zero and give it one step of room.
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
    if (lo === hi) return { ticks: [0, 1], domainMin: 0, domainMax: 1 };
  }

  const rawStep = (hi - lo) / Math.max(1, targetCount - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / magnitude;
  const step =
    (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) *
    magnitude;

  const floorLo = Math.floor(lo / step) * step;
  const ceilHi = Math.ceil(hi / step) * step;
  const domainMin = lo - floorLo <= step / 2 ? floorLo : lo;
  const domainMax = ceilHi - hi <= step / 2 ? ceilHi : hi;

  const epsilon = step * 1e-9;
  const first = Math.ceil((domainMin - epsilon) / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= domainMax + epsilon; tick += step) {
    // Clean float drift; −0 must never label as "−0".
    ticks.push(Math.abs(tick) < epsilon ? 0 : Number(tick.toPrecision(12)));
  }
  return { ticks, domainMin, domainMax };
};

/**
 * The TimeseriesPanel domain rule on top of `niceScale`: zero-based min
 * (latency/rate axes start at 0 — master 50:407), 5% headroom above the
 * data, 4 target ticks, and a top gridline that always CAPS the plot
 * (the master's 600 ms line sits above the 520 ms peak — the series
 * never rides past the last tick). Shared with ReplayPanel so its
 * ThresholdOverlay fractions land on the same domain the panel plots.
 */
export const plotScale = (values: number[]): ChartScale => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo)) return niceScale(0, 1, 4);
  const scale =
    lo === hi
      ? niceScale(lo - 1, hi + 1, 4)
      : niceScale(Math.min(lo, 0), hi * 1.05, 4);
  const { ticks } = scale;
  if (ticks.length >= 2) {
    const step = ticks[1] - ticks[0];
    const last = ticks[ticks.length - 1];
    if (last < scale.domainMax - step * 1e-9) {
      const top = Number((last + step).toPrecision(12));
      return { ...scale, ticks: [...ticks, top], domainMax: top };
    }
  }
  return scale;
};
