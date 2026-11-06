import { useRef, useState } from "react";
import { INNER_WIDTH, PAD_L, PLOT_W } from "./timeseries-geometry";
import type { TimeseriesPanelProps } from "./TimeseriesPanel";

export function useTimeseriesInteraction({
  onCursorChange,
  onZoomRange,
  onZoomReset,
}: Pick<
  TimeseriesPanelProps,
  "onCursorChange" | "onZoomRange" | "onZoomReset"
>) {
  const [localCursor, setLocalCursor] = useState<number | null>(null);
  /** MI-3 drag selection, fractions of the plot width. */
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const fracAt = (clientX: number): number | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const fx = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, (fx * PLOT_W - PAD_L) / INNER_WIDTH));
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const frac = fracAt(e.clientX);
    if (frac === null) return;
    if (dragging.current) {
      setDrag((d) => (d ? { ...d, to: frac } : d));
      return;
    }
    setLocalCursor(frac);
    onCursorChange?.(frac);
  };

  const handleLeave = () => {
    setLocalCursor(null);
    onCursorChange?.(null);
    dragging.current = false;
    setDrag(null);
  };

  const handleDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onZoomRange) return;
    const frac = fracAt(e.clientX);
    if (frac === null) return;
    dragging.current = true;
    setDrag({ from: frac, to: frac });
  };

  const handleUp = () => {
    if (!dragging.current || !drag) return;
    dragging.current = false;
    const lo = Math.min(drag.from, drag.to);
    const hi = Math.max(drag.from, drag.to);
    setDrag(null);
    // ignore sub-2% drags — that's a click, not a zoom
    if (hi - lo >= 0.02) onZoomRange?.(lo, hi);
  };

  return {
    localCursor,
    drag,
    svgProps: {
      ref: svgRef,
      onMouseMove: handleMove,
      onMouseLeave: handleLeave,
      onMouseDown: handleDown,
      onMouseUp: handleUp,
      onDoubleClick: onZoomReset,
    },
  };
}
