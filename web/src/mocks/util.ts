/** Deterministic helpers for the mock server — same inputs, same telemetry. */

/** FNV-1a string hash → uint32 seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — deterministic, fast, good enough for fixtures. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One deterministic sample in [0,1) for a composite key. */
export function unitFor(key: string): number {
  return mulberry32(hashSeed(key))();
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

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
