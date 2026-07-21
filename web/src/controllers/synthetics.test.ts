import { describe, expect, it } from "vitest";
import type { SyntheticRun } from "@/models";
import { selectRun } from "./synthetics";

function run(id: string, number: number): SyntheticRun {
  return {
    id,
    check_id: "syn_checkout",
    number,
    status: "pass",
    started_at: "2026-07-20T10:00:00Z",
    total_ms: 754,
    steps: [],
    steps_total: 5,
    failure_screenshot: null,
  };
}

// newest first, as the repo returns them
const RUNS = [run("synrun_0009", 482), run("synrun_0008", 481)];

describe("B7 ?run= deep link (audit fix 2026-07-20 — id OR visible number)", () => {
  it("selects the latest run when no ?run= is given", () => {
    expect(selectRun(RUNS, null)?.id).toBe("synrun_0009");
    expect(selectRun([], null)).toBeNull();
  });

  it("resolves the internal id (synrun_0008)", () => {
    expect(selectRun(RUNS, "synrun_0008")?.number).toBe(481);
  });

  it("resolves the visible run number — the frame addresses run #482", () => {
    expect(selectRun(RUNS, "482")?.id).toBe("synrun_0009");
    expect(selectRun(RUNS, "#482")?.id).toBe("synrun_0009");
  });

  it("returns null for an unknown value — the page says 'Run … not found', never the 'No runs yet' empty copy", () => {
    expect(selectRun(RUNS, "synrun_9999")).toBeNull();
    expect(selectRun(RUNS, "#9999")).toBeNull();
  });
});
