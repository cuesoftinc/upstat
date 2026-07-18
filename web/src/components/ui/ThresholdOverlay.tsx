"use client";

import { clsx } from "clsx";

export interface ThresholdOverlayProps {
  /** Warn band lower bound as a fraction of plot height (0 bottom, 1 top). */
  warnFrom?: number;
  /** Crit band lower bound as a fraction of plot height. */
  critFrom?: number;
  /** Would-have-fired marker positions as fractions of plot width (MI-9). */
  markers?: number[];
  className?: string;
}

/**
 * ThresholdOverlay — §8.2b: warn band / crit band / would-have-fired
 * markers; composes over TimeseriesPanel for the MI-9 test replay.
 */
export function ThresholdOverlay({ warnFrom, critFrom, markers = [], className }: ThresholdOverlayProps) {
  return (
    <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0", className)}>
      {warnFrom !== undefined && (
        <div
          data-band="warn"
          className="absolute inset-x-0 border-t border-dashed border-warn bg-warn/10"
          style={{ top: `${(1 - warnFrom) * 100}%`, bottom: critFrom !== undefined ? `${critFrom * 100}%` : 0 }}
        />
      )}
      {critFrom !== undefined && (
        <div
          data-band="crit"
          className="absolute inset-x-0 bottom-auto border-t border-dashed border-crit bg-crit/10"
          style={{ top: `${(1 - critFrom) * 100}%`, height: `${critFrom * 100}%` }}
        />
      )}
      {markers.map((m, i) => (
        <span
          key={i}
          data-marker
          className="absolute top-0 h-full w-px bg-crit"
          style={{ left: `${m * 100}%` }}
        >
          <span className="absolute -left-1 top-0 size-2 rounded-full bg-crit" />
        </span>
      ))}
    </div>
  );
}
