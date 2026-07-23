/** Mock-server-specific helpers (deterministic ids + chart step snapping).
 *  Generic time/date and PRNG helpers live in `@/lib/format` and
 *  `@/lib/random` — import those directly rather than re-exporting them
 *  here. */

import { DAY, HOUR, MINUTE, SECOND } from "@/lib/format";

/** Step snapping per query-grammar.md §4: range/200 → 10s/1m/5m/1h/1d. */
export function snapStepMs(rangeMs: number): number {
  const raw = rangeMs / 200;
  const steps = [10 * SECOND, MINUTE, 5 * MINUTE, HOUR, DAY];
  for (const s of steps) if (raw <= s) return s;
  return DAY;
}

export function stepLabel(stepMs: number): string {
  if (stepMs >= DAY) return `${Math.round(stepMs / DAY)}d`;
  if (stepMs >= HOUR) return `${Math.round(stepMs / HOUR)}h`;
  if (stepMs >= MINUTE) return `${Math.round(stepMs / MINUTE)}m`;
  return `${Math.round(stepMs / SECOND)}s`;
}

let idCounter = 0;
/** Monotonic ids — stable ordering inside one mock-server lifetime. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36).padStart(4, "0")}`;
}
