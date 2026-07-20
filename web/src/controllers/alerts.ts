"use client";

import { useCallback, useState } from "react";
import { alertsRepo } from "@/models/repositories";
import type { AlertChannel, AlertRule, RuleTestResult } from "@/models";
import { useRequest } from "./use-request";

/**
 * B8 "monitor status page (grouped by state)" — [Decided 2026-07-20]
 * literal reading: the monitors list gains a group-by-state view over the
 * rules. Groups render in worst-first order; a rule carrying any mute
 * window groups under Muted regardless of its evaluation state (the rule
 * editor's mute semantics — mute_windows are recurrence strings, presence
 * = muted).
 */
export type MonitorStateGroup =
  "triggered" | "warn" | "ok" | "nodata" | "muted";

export const MONITOR_STATE_GROUPS: {
  key: MonitorStateGroup;
  label: string;
}[] = [
  { key: "triggered", label: "Triggered" },
  { key: "warn", label: "Warn" },
  { key: "ok", label: "OK" },
  { key: "nodata", label: "No data" },
  { key: "muted", label: "Muted" },
];

/** Presence of any mute window = muted (the rule editor's semantics). */
export function ruleMuted(rule: AlertRule): boolean {
  return rule.notify.mute_windows.length > 0;
}

export function groupRulesByState(
  rules: AlertRule[],
): Record<MonitorStateGroup, AlertRule[]> {
  const groups: Record<MonitorStateGroup, AlertRule[]> = {
    triggered: [],
    warn: [],
    ok: [],
    nodata: [],
    muted: [],
  };
  for (const rule of rules) {
    if (ruleMuted(rule)) groups.muted.push(rule);
    else if (rule.state === "alert") groups.triggered.push(rule);
    else groups[rule.state].push(rule);
  }
  return groups;
}

/** Alerting controller — channels + rules CRUD + triggered feed (pages.md B8). */
export function useAlertsController() {
  const channels = useRequest(() => alertsRepo.channels(), []);
  const rules = useRequest(() => alertsRepo.rules(), []);
  const feed = useRequest(() => alertsRepo.feed(), []);

  const createChannel = useCallback(
    async (input: Pick<AlertChannel, "kind" | "target">) => {
      await alertsRepo.createChannel(input);
      await channels.reload();
    },
    [channels],
  );

  const removeChannel = useCallback(
    async (id: string) => {
      await alertsRepo.removeChannel(id);
      await channels.reload();
    },
    [channels],
  );

  const createRule = useCallback(
    async (
      input: Omit<AlertRule, "id" | "org_id" | "state" | "last_triggered_at">,
    ) => {
      await alertsRepo.createRule(input);
      await rules.reload();
    },
    [rules],
  );

  const removeRule = useCallback(
    async (id: string) => {
      await alertsRepo.removeRule(id);
      await rules.reload();
    },
    [rules],
  );

  const updateRule = useCallback(
    async (id: string, patch: Partial<AlertRule>) => {
      await alertsRepo.updateRule(id, patch);
      await rules.reload();
    },
    [rules],
  );

  /** MI-9 — replay a rule's last 24h (the repository call, controller-owned). */
  const testRule = useCallback((id: string) => alertsRepo.testRule(id), []);

  const verifyChannel = useCallback(
    async (id: string) => {
      await alertsRepo.verifyChannel(id);
      await channels.reload();
    },
    [channels],
  );

  return {
    channels,
    rules,
    feed,
    createChannel,
    verifyChannel,
    removeChannel,
    createRule,
    updateRule,
    removeRule,
    testRule,
  };
}

/** Single rule + MI-9 test replay (trigger bands, would-have-fired markers). */
export function useRuleController(id: string) {
  const rules = useRequest(() => alertsRepo.rules(), []);
  const rule = (rules.data ?? []).find((r) => r.id === id) ?? null;
  const test = useRuleTest(() => alertsRepo.testRule(id));
  return { rules, rule, ...test };
}

/** Shared MI-9 runner (rules + the uptime-monitor variant). */
export function useRuleTest(run: () => Promise<RuleTestResult>) {
  const [testResult, setTestResult] = useState<RuleTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setTestError(null);
    try {
      setTestResult(await run());
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "test failed");
    } finally {
      setTesting(false);
    }
  }, [run]);

  return { testResult, testing, testError, runTest };
}
