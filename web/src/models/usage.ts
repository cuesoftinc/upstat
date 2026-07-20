/** B12 usage metering (pages.md B12 [Designed 2026-07-20], OBS-012). */

export type UsagePillar = "metrics" | "logs" | "traces" | "rum";

/** One UsageMeterRow (design.md §8.2b). */
export interface UsageMeter {
  pillar: UsagePillar;
  /** "Metrics — active series" · "Logs — ingested" · … */
  label: string;
  /** Raw MTD value (bytes for logs; counts elsewhere). */
  value: number;
  /** Human form ("212 GB", "9.8M"). */
  display: string;
  /** Trailing-3-month peak — the bar's denominator (§8.2b). */
  peak: number;
  /** Verbatim plan column (accuracy canon — no invented quotas/pricing). */
  plan: string;
}

export interface UsageReport {
  /** "July 2026" — resolved in the org timezone (X-10). */
  month_label: string;
  rows: UsageMeter[];
}
