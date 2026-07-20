/**
 * Synthetics beyond HTTP — multi-step API checks and browser checks
 * (pages.md B7 [Designed 2026-07-20], OBS-011). Classic single-URL HTTP
 * checks stay Monitors (models/monitors.ts); these are the step-composed
 * checks the B7 builder produces.
 */

export type SyntheticCheckKind = "multi_step" | "browser";

export type SyntheticStepKind = "http" | "assertion" | "wait";

export type HttpStepMethod = "GET" | "POST" | "HEAD";

/** Builder-editable step params — the server derives the mono summary. */
export type SyntheticStepInput =
  | { kind: "http"; method: HttpStepMethod; url: string }
  | { kind: "assertion"; expression: string }
  | { kind: "wait"; wait_ms: number };

export interface SyntheticStep {
  id: string;
  kind: SyntheticStepKind;
  /** Mono row summary — `GET https://…` / `status == 200` / `wait 500 ms`. */
  summary: string;
  method?: HttpStepMethod;
  url?: string;
  expression?: string;
  wait_ms?: number;
}

/** The browser-check panel (URL · viewport · screenshot-on-failure). */
export interface BrowserCheckConfig {
  url: string;
  /** `1440x900` / `768x1024` / `390x844` — the builder's viewport Select. */
  viewport: string;
  screenshot_on_failure: boolean;
}

export interface SyntheticCheck {
  id: string;
  name: string;
  kind: SyntheticCheckKind;
  /** Ordered steps (multi_step; browser checks may carry none). */
  steps: SyntheticStep[];
  /** Present on browser checks and multi-step checks with a browser stage. */
  browser: BrowserCheckConfig | null;
  interval_seconds: number;
  last_run_id: string | null;
  last_run_status: SyntheticRunStatus | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SyntheticRunStatus = "pass" | "fail";

/** One executed step in a run (StepResultRow contract, design.md §8.2b). */
export interface SyntheticStepResult {
  /** 1-based step index. */
  index: number;
  kind: SyntheticStepKind;
  summary: string;
  status: SyntheticRunStatus;
  duration_ms: number;
}

export interface SyntheticRun {
  id: string;
  check_id: string;
  /** Monotonic run number (`run #482`). */
  number: number;
  status: SyntheticRunStatus;
  started_at: string;
  /** Sum of executed step durations. */
  total_ms: number;
  /**
   * Executed steps only — the check stops at the first failure; steps
   * after a FAIL are not run and carry no result rows.
   */
  steps: SyntheticStepResult[];
  /** Total steps in the check at run time (for "steps n–m not run"). */
  steps_total: number;
  /** Present when a failing run captured a screenshot (browser config). */
  failure_screenshot: { step_index: number; viewport: string } | null;
}

/** Create/update payload the builder submits. */
export interface SyntheticCheckInput {
  name: string;
  kind: SyntheticCheckKind;
  steps: SyntheticStepInput[];
  browser: BrowserCheckConfig | null;
  interval_seconds?: number;
}

/**
 * Mono row summary per step kind — `GET https://…` / `status == 200` /
 * `wait 500 ms`. Shared by the builder rows and the mock server (contract
 * types + derivations live with models, web-implementation.md §1).
 */
export function stepSummary(input: SyntheticStepInput): string {
  switch (input.kind) {
    case "http":
      return `${input.method} ${input.url}`;
    case "assertion":
      return input.expression;
    case "wait":
      return `wait ${input.wait_ms} ms`;
  }
}
