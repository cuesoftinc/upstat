import { describe, expect, it } from "vitest";
import type { AlertRule } from "@/models";
import { MONITOR_STATE_GROUPS, groupRulesByState, ruleMuted } from "./alerts";

function rule(
  id: string,
  state: AlertRule["state"],
  muteWindows: { from: string; to: string }[] = [],
): AlertRule {
  return {
    id,
    org_id: "org_1",
    name: id,
    signal: "metric",
    query: { v: 1, filters: { op: "and", terms: [] }, agg: [], step: "auto" },
    query_string: "q",
    thresholds: { warn: 1, crit: 2, window: "5m" },
    notify: {
      channel_ids: [],
      cooldown_minutes: 5,
      renotify_minutes: 0,
      mute_windows: muteWindows,
    },
    state,
    last_triggered_at: null,
  };
}

describe("B8 grouped monitors ([Decided 2026-07-20] group-by-state view)", () => {
  it("orders groups worst-first: Triggered / Warn / OK / No data / Muted", () => {
    expect(MONITOR_STATE_GROUPS.map((g) => g.key)).toEqual([
      "triggered",
      "warn",
      "ok",
      "nodata",
      "muted",
    ]);
  });

  it("groups rules by evaluation state (alert → Triggered)", () => {
    const groups = groupRulesByState([
      rule("a", "alert"),
      rule("b", "warn"),
      rule("c", "ok"),
      rule("d", "nodata"),
      rule("e", "warn"),
    ]);
    expect(groups.triggered.map((r) => r.id)).toEqual(["a"]);
    expect(groups.warn.map((r) => r.id)).toEqual(["b", "e"]);
    expect(groups.ok.map((r) => r.id)).toEqual(["c"]);
    expect(groups.nodata.map((r) => r.id)).toEqual(["d"]);
    expect(groups.muted).toEqual([]);
  });

  it("mute wins over state: any mute window groups the rule under Muted", () => {
    const muted = rule("m", "alert", [{ from: "SAT 00:00", to: "MON 00:00" }]);
    expect(ruleMuted(muted)).toBe(true);
    const groups = groupRulesByState([muted, rule("t", "alert")]);
    expect(groups.muted.map((r) => r.id)).toEqual(["m"]);
    expect(groups.triggered.map((r) => r.id)).toEqual(["t"]);
  });
});
