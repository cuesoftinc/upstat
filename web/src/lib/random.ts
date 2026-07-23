/** Generic deterministic-randomness helpers — same inputs, same output.
 *  Reused by mock data generation (`mocks/`) and by app controllers alike
 *  (e.g. `controllers/home.ts`'s demo chart). */

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
