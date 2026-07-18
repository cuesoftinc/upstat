/** SLOs — data-model.md §5; pages.md B10; SLOCard states (MI-15). */

export type SliSource = "check" | "metric_ratio" | "latency";
export type SloState = "healthy" | "burning" | "exhausted";

export interface Slo {
  id: string;
  org_id: string;
  name: string;
  sli_source: SliSource;
  /** e.g. 99.9 */
  target: number;
  /** e.g. `30d` rolling. */
  window: string;
  /** Current attainment, e.g. 99.93. */
  current: number;
  /** Remaining error budget, 0..100. */
  budget_remaining_pct: number;
  /** Burn rate multiple (1 = burning exactly at budget). */
  burn_rate: number;
  state: SloState;
}
