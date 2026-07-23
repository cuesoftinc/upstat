/** Generic time/date formatting helpers — reused by mock data generation
 *  (`mocks/`) and by app controllers alike (e.g. `controllers/home.ts`). */

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Epoch milliseconds → ISO 8601 string. */
export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
