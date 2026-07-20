/**
 * Synthetic checks (pages.md B7 multi-step/browser, OBS-011) — step
 * normalization, validation, and the deterministic run replay behind
 * POST /v1/synthetics/{id}/runs. Same-input-same-result like every mock
 * generator (mocks/series.ts).
 */

import {
  stepSummary,
  type SyntheticCheck,
  type SyntheticCheckInput,
  type SyntheticRun,
  type SyntheticStep,
  type SyntheticStepInput,
  type SyntheticStepResult,
} from "@/models";
import { hashSeed, iso, mulberry32, nextId } from "./util";

export const SYNTHETIC_VIEWPORTS = ["1440x900", "768x1024", "390x844"] as const;

export type StepValidationError = { code: string; message: string };

/** Validate a builder payload — snake_case catalog codes (engineering.md). */
export function validateCheckInput(
  input: Partial<SyntheticCheckInput>,
): StepValidationError | null {
  if (!input.name?.trim()) {
    return { code: "name_required", message: "check name is required" };
  }
  if (input.kind !== "multi_step" && input.kind !== "browser") {
    return {
      code: "invalid_kind",
      message: "kind must be multi_step or browser",
    };
  }
  const steps = input.steps ?? [];
  if (input.kind === "multi_step" && steps.length === 0) {
    return { code: "steps_required", message: "add at least one step" };
  }
  for (const step of steps) {
    if (step.kind === "http") {
      if (!/^https?:\/\/.+/.test(step.url ?? "")) {
        return { code: "invalid_target", message: "step URL must be http(s)" };
      }
    } else if (step.kind === "assertion") {
      if (!step.expression?.trim()) {
        return {
          code: "invalid_expression",
          message: "assertion expression is required",
        };
      }
    } else if (step.kind === "wait") {
      if (!Number.isFinite(step.wait_ms) || step.wait_ms <= 0) {
        return {
          code: "invalid_wait",
          message: "wait must be a positive ms value",
        };
      }
    } else {
      return {
        code: "invalid_step_kind",
        message: "step kind must be http, assertion or wait",
      };
    }
  }
  if (input.kind === "browser" || input.browser) {
    const browser = input.browser;
    if (!browser || !/^https?:\/\/.+/.test(browser.url)) {
      return { code: "invalid_target", message: "browser URL must be http(s)" };
    }
    if (!SYNTHETIC_VIEWPORTS.includes(browser.viewport as never)) {
      return {
        code: "invalid_viewport",
        message: `viewport must be one of ${SYNTHETIC_VIEWPORTS.join(", ")}`,
      };
    }
  }
  return null;
}

/** Normalize builder inputs into stored steps (ids + derived summaries). */
export function normalizeSteps(inputs: SyntheticStepInput[]): SyntheticStep[] {
  return inputs.map((input) => ({
    id: nextId("step"),
    kind: input.kind,
    summary: stepSummary(input),
    ...(input.kind === "http" ? { method: input.method, url: input.url } : {}),
    ...(input.kind === "assertion" ? { expression: input.expression } : {}),
    ...(input.kind === "wait" ? { wait_ms: input.wait_ms } : {}),
  }));
}

/** Deterministic per-step duration (ms) for a run. */
function stepDuration(
  step: SyntheticStep,
  checkId: string,
  runNumber: number,
  index: number,
): number {
  if (step.kind === "wait" && step.wait_ms) return step.wait_ms;
  const r = mulberry32(hashSeed(`run:${checkId}:${runNumber}:${index}`));
  // http steps span network latency; assertions evaluate a stored body
  return step.kind === "http"
    ? Math.round(90 + r() * 320)
    : Math.round(40 + r() * 90);
}

/**
 * Execute a run deterministically. `failAtIndex` (0-based) forces a FAIL at
 * that step — the seed narrative uses it for the INC-42-window run; live
 * "Run once" calls pass it as null (nothing is failing right now).
 */
export function executeRun(
  check: SyntheticCheck,
  runNumber: number,
  atMs: number,
  failAtIndex: number | null = null,
): SyntheticRun {
  const results: SyntheticStepResult[] = [];
  let total = 0;
  let failed = false;
  for (let i = 0; i < check.steps.length; i++) {
    const step = check.steps[i];
    const status = failAtIndex === i ? "fail" : "pass";
    const duration =
      status === "fail"
        ? // failing assertions wait out the retry budget — visibly longer
          Math.round(
            420 + mulberry32(hashSeed(`fail:${check.id}:${runNumber}`))() * 160,
          )
        : stepDuration(step, check.id, runNumber, i);
    results.push({
      index: i + 1,
      kind: step.kind,
      summary: step.summary,
      status,
      duration_ms: duration,
    });
    total += duration;
    if (status === "fail") {
      failed = true;
      break; // stop at first failure
    }
  }
  return {
    id: nextId("synrun"),
    check_id: check.id,
    number: runNumber,
    status: failed ? "fail" : "pass",
    started_at: iso(atMs),
    total_ms: total,
    steps: results,
    steps_total: check.steps.length,
    failure_screenshot:
      failed && check.browser?.screenshot_on_failure
        ? {
            step_index: results[results.length - 1].index,
            viewport: check.browser.viewport,
          }
        : null,
  };
}

/**
 * Seeded multi-step check + run history — "checkout flow — api + web"
 * verifies the API health endpoint then the checkout page in a headless
 * browser. Runs every 30m; the run inside the INC-42 window FAILED at the
 * `body.ok == true` assertion (checkout's health degraded during the
 * incident) and captured a failure screenshot; later runs pass (INC-42 is
 * MONITORING — mitigated).
 */
export function seedSynthetics(
  now: number,
  outage: { start: number; end: number },
): { checks: SyntheticCheck[]; runs: Record<string, SyntheticRun[]> } {
  const MINUTE = 60_000;
  const check: SyntheticCheck = {
    id: "syn_checkout",
    name: "checkout flow — api + web",
    kind: "multi_step",
    steps: normalizeSteps([
      {
        kind: "http",
        method: "GET",
        url: "https://api.upstat.cuesoft.io/health",
      },
      { kind: "assertion", expression: "status == 200" },
      { kind: "assertion", expression: "body.ok == true" },
      { kind: "wait", wait_ms: 500 },
      { kind: "http", method: "GET", url: "https://checkout.cuesoft.io/" },
    ]),
    browser: {
      url: "https://checkout.cuesoft.io/",
      viewport: "1440x900",
      screenshot_on_failure: true,
    },
    interval_seconds: 1800,
    last_run_id: null,
    last_run_status: null,
    last_run_at: null,
    created_at: iso(now - 45 * 24 * 60 * MINUTE),
    updated_at: iso(now - 45 * 24 * 60 * MINUTE),
  };

  // Every 30m, newest #487 twelve minutes ago → #482 lands 2h42m ago,
  // inside the INC-42 window (started 3h ago, mitigated 2h15m ago).
  const runs: SyntheticRun[] = [];
  for (let number = 481; number <= 487; number++) {
    const atMs = now - 12 * MINUTE - (487 - number) * 30 * MINUTE;
    const inOutage = atMs >= outage.start && atMs <= outage.end;
    // the degraded health body fails the `body.ok == true` assertion (step 3)
    runs.push(executeRun(check, number, atMs, inOutage ? 2 : null));
  }
  runs.reverse(); // newest first
  const latest = runs[0];
  check.last_run_id = latest.id;
  check.last_run_status = latest.status;
  check.last_run_at = latest.started_at;
  return { checks: [check], runs: { [check.id]: runs } };
}
