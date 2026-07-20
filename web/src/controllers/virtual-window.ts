/**
 * Bespoke list windowing — pages.md B4 "LogLine list (virtualized)".
 *
 * No virtualization dependency (component-reuse policy: a light bespoke
 * window suffices for fixed-height rows): the list renders a top spacer ·
 * a visible slice · a bottom spacer, so the container's scrollHeight stays
 * truthful — which is exactly what keeps MI-4's bottom-pinned auto-scroll
 * and scroll-up pause semantics intact. Collapsed LogLines have one fixed
 * height; the only variable is MI-5 expansion, carried as per-index
 * `extras` (measured by the view) — O(expanded) per scroll frame.
 */

export interface WindowExtra {
  /** Row index in the rendered (ascending) list. */
  index: number;
  /** Height beyond the fixed row height, px. */
  extra: number;
}

export interface VirtualWindowInput {
  /** Total row count. */
  count: number;
  /** Fixed collapsed row height, px (content + border). */
  rowHeight: number;
  /** Scroll container's inner height, px. */
  viewportHeight: number;
  scrollTop: number;
  /** Expanded rows' extra heights, sorted by index ascending. */
  extras: WindowExtra[];
  /** Rows rendered beyond each viewport edge. */
  overscan?: number;
}

export interface VirtualWindowResult {
  /** Rendered slice [start, end). */
  start: number;
  end: number;
  /** Spacer heights replacing the unrendered rows. */
  padTop: number;
  padBottom: number;
  totalHeight: number;
}

/** Content offset of a row = index·rowHeight + extras above it. */
function offsetOf(index: number, rowHeight: number, extras: WindowExtra[]) {
  let extraAbove = 0;
  for (const e of extras) {
    if (e.index < index) extraAbove += e.extra;
    else break;
  }
  return index * rowHeight + extraAbove;
}

/** First row whose bottom edge sits below content offset `y`. */
function indexAt(y: number, rowHeight: number, extras: WindowExtra[]) {
  let extraAbove = 0;
  for (const e of extras) {
    const top = e.index * rowHeight + extraAbove;
    if (top + rowHeight + e.extra <= y) extraAbove += e.extra;
    else if (top <= y) return e.index; // y lands inside this expanded row
    else break;
  }
  return Math.max(0, Math.floor((y - extraAbove) / rowHeight));
}

export function computeVirtualWindow({
  count,
  rowHeight,
  viewportHeight,
  scrollTop,
  extras,
  overscan = 20,
}: VirtualWindowInput): VirtualWindowResult {
  if (count === 0) {
    return { start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 };
  }
  const inRange = extras
    .filter((e) => e.index >= 0 && e.index < count)
    .sort((a, b) => a.index - b.index);
  const totalExtra = inRange.reduce((sum, e) => sum + e.extra, 0);
  const totalHeight = count * rowHeight + totalExtra;

  const start = Math.max(0, indexAt(scrollTop, rowHeight, inRange) - overscan);
  const end = Math.min(
    count,
    indexAt(scrollTop + viewportHeight, rowHeight, inRange) + 1 + overscan,
  );
  const padTop = offsetOf(start, rowHeight, inRange);
  const padBottom = Math.max(0, totalHeight - offsetOf(end, rowHeight, inRange));
  return { start, end, padTop, padBottom, totalHeight };
}
