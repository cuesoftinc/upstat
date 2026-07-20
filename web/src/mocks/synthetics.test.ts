import { describe, expect, it } from "vitest";
import { executeRun, seedSynthetics, validateCheckInput } from "./synthetics";
import { stepSummary } from "@/models";

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe("stepSummary", () => {
  it("derives the mono row copy per kind", () => {
    expect(
      stepSummary({ kind: "http", method: "GET", url: "https://a.io/h" }),
    ).toBe("GET https://a.io/h");
    expect(
      stepSummary({ kind: "assertion", expression: "status == 200" }),
    ).toBe("status == 200");
    expect(stepSummary({ kind: "wait", wait_ms: 500 })).toBe("wait 500 ms");
  });
});

describe("validateCheckInput", () => {
  const base = {
    name: "x",
    kind: "multi_step" as const,
    steps: [
      { kind: "http" as const, method: "GET" as const, url: "https://a.io" },
    ],
    browser: null,
  };
  it("accepts a valid multi-step payload", () => {
    expect(validateCheckInput(base)).toBeNull();
  });
  it("rejects with snake_case catalog codes", () => {
    expect(validateCheckInput({ ...base, name: " " })?.code).toBe(
      "name_required",
    );
    expect(validateCheckInput({ ...base, steps: [] })?.code).toBe(
      "steps_required",
    );
    expect(
      validateCheckInput({
        ...base,
        steps: [{ kind: "http", method: "GET", url: "ftp://nope" }],
      })?.code,
    ).toBe("invalid_target");
    expect(
      validateCheckInput({
        ...base,
        steps: [{ kind: "wait", wait_ms: -1 }],
      })?.code,
    ).toBe("invalid_wait");
    expect(
      validateCheckInput({
        ...base,
        kind: "browser",
        steps: [],
        browser: {
          url: "https://a.io",
          viewport: "999x999",
          screenshot_on_failure: true,
        },
      })?.code,
    ).toBe("invalid_viewport");
  });
});

describe("executeRun", () => {
  const now = Date.parse("2026-07-20T12:00:00Z");
  const seeded = seedSynthetics(now, {
    start: now - 3 * HOUR,
    end: now - 2 * HOUR - 15 * MINUTE,
  });
  const check = seeded.checks[0];

  it("is deterministic — same check + run number = identical results", () => {
    const a = executeRun(check, 500, now);
    const b = executeRun(check, 500, now);
    expect(a.steps).toEqual(b.steps);
    expect(a.total_ms).toBe(b.total_ms);
    expect(a.status).toBe("pass");
    expect(a.steps).toHaveLength(check.steps.length);
  });

  it("stops at the first failure and captures the screenshot", () => {
    const run = executeRun(check, 501, now, 2);
    expect(run.status).toBe("fail");
    expect(run.steps).toHaveLength(3); // steps 4–5 not run
    expect(run.steps[2].status).toBe("fail");
    expect(run.steps_total).toBe(5);
    expect(run.failure_screenshot).toEqual({
      step_index: 3,
      viewport: "1440x900",
    });
    // total = sum of executed durations only
    expect(run.total_ms).toBe(run.steps.reduce((s, r) => s + r.duration_ms, 0));
  });

  it("wait steps run for exactly their configured wait", () => {
    const run = executeRun(check, 502, now);
    const wait = run.steps.find((s) => s.kind === "wait");
    expect(wait?.duration_ms).toBe(500);
  });
});

describe("seedSynthetics", () => {
  const now = Date.parse("2026-07-20T12:00:00Z");
  const outage = { start: now - 3 * HOUR, end: now - 2 * HOUR - 15 * MINUTE };
  const { checks, runs } = seedSynthetics(now, outage);

  it("seeds the multi-step checkout check with a browser stage", () => {
    expect(checks).toHaveLength(1);
    expect(checks[0].kind).toBe("multi_step");
    expect(checks[0].steps.map((s) => s.kind)).toEqual([
      "http",
      "assertion",
      "assertion",
      "wait",
      "http",
    ]);
    expect(checks[0].browser?.screenshot_on_failure).toBe(true);
  });

  it("the run inside the INC-42 window fails; neighbours pass (coherence)", () => {
    const history = runs[checks[0].id];
    const byNumber = new Map(history.map((r) => [r.number, r]));
    const failing = history.filter((r) => r.status === "fail");
    expect(failing).toHaveLength(1);
    const failTs = Date.parse(failing[0].started_at);
    expect(failTs).toBeGreaterThanOrEqual(outage.start);
    expect(failTs).toBeLessThanOrEqual(outage.end);
    expect(failing[0].number).toBe(482);
    expect(byNumber.get(481)?.status).toBe("pass");
    expect(byNumber.get(483)?.status).toBe("pass");
    // latest run is reflected on the check row
    expect(checks[0].last_run_status).toBe("pass");
    expect(checks[0].last_run_id).toBe(history[0].id);
  });
});
