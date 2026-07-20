"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertChannelCard } from "@/components/ui/AlertChannelCard";
import { AlertFeedRow } from "@/components/ui/AlertFeedRow";
import { AlertRuleCard } from "@/components/ui/AlertRuleCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AlertEvent, AlertRule } from "@/models";
import {
  MONITOR_STATE_GROUPS,
  groupRulesByState,
  useAlertsController,
  useRuleTest,
} from "@/controllers/alerts";
import { clsx } from "clsx";
import { DeclareIncidentModal } from "../incidents/DeclareIncidentModal";
import { RuleEditor, type RuleInput } from "./rule-editor";
import { ReplayPanel } from "../replay-panel";

/**
 * B8 Monitors (Figma 130:2621) — rules list + notification channels +
 * triggered feed (MI-14); inline rule editor with MI-9 test replay.
 */
export default function MonitorsPage() {
  const router = useRouter();
  const ctrl = useAlertsController();
  // reactive search params — reading window.location races client navigation
  const searchParams = useSearchParams();
  const ruleParam = searchParams.get("rule");
  const [selectedId, setSelectedId] = useState<string | null>(ruleParam);
  // B8 grouped-by-state view [Decided 2026-07-20] — URL-addressable per the
  // §1 query duality rule (?view=state)
  const [view, setView] = useState<"list" | "state">(
    searchParams.get("view") === "state" ? "state" : "list",
  );
  const setViewMode = (next: "list" | "state") => {
    setView(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "state") params.set("view", "state");
    else params.delete("view");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // pages.md B9 [Directive]: declare-incident reachable FROM an alert row
  const [declareFrom, setDeclareFrom] = useState<AlertEvent | null>(null);

  const rules = ctrl.rules.data ?? [];
  const selected = rules.find((r) => r.id === selectedId) ?? rules[0] ?? null;
  const { testResult, testing, runTest } = useRuleTest(async () => {
    if (!selected) throw new Error("no rule selected");
    return ctrl.testRule(selected.id);
  });

  // Frame 130:2621: the threshold test replay renders INLINE in the edit
  // panel — auto-run it whenever the selected rule changes ("Test rule"
  // re-runs it). runTest's identity changes per render; keep the latest
  // in a ref so the replay effect keys on the rule alone.
  const runTestRef = useRef(runTest);
  useEffect(() => {
    runTestRef.current = runTest;
  });
  const selectedRuleId = selected?.id ?? null;
  useEffect(() => {
    if (selectedRuleId) void runTestRef.current();
  }, [selectedRuleId]);

  const save = async (input: RuleInput) => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await ctrl.updateRule(selected.id, input);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "could not save the rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="monitors-page">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Monitors</h1>
        <Button
          onClick={() => router.push("/dashboard/monitors/new")}
          data-testid="new-monitor"
        >
          New monitor
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="rules-heading">
            <header className="mb-3 flex items-center justify-between gap-3">
              <h2 id="rules-heading" className="text-[16px] font-semibold">
                Rules
              </h2>
              {/* B8 [Decided 2026-07-20]: the monitors list gains a
                  group-by-state view — Triggered / Warn / OK / No data /
                  Muted with counts */}
              <div
                role="group"
                aria-label="Rules view"
                className="flex overflow-hidden rounded-(--radius) border border-border"
              >
                {(
                  [
                    { key: "list", label: "List" },
                    { key: "state", label: "By state" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={view === key}
                    data-testid={`rules-view-${key}`}
                    onClick={() => setViewMode(key)}
                    className={clsx(
                      "px-2 py-1 text-[12px] font-medium transition-colors duration-[var(--duration-fast)]",
                      view === key
                        ? "bg-bg-elev text-text"
                        : "text-text-2 hover:text-text",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            {ctrl.rules.loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} kind="panel-axis" style={{ height: 88 }} />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2">
                No monitor rules yet — create one on any signal.
              </p>
            ) : view === "state" ? (
              <div className="flex flex-col gap-5" data-testid="rules-by-state">
                {MONITOR_STATE_GROUPS.map(({ key, label }) => {
                  const bucket = groupRulesByState(rules)[key];
                  return (
                    <section
                      key={key}
                      aria-labelledby={`rules-group-${key}`}
                      data-testid={`rules-group-${key}`}
                    >
                      <h3
                        id={`rules-group-${key}`}
                        className="mb-2 flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wide text-text-2"
                      >
                        {label}
                        <span
                          data-testid={`rules-count-${key}`}
                          className="font-data font-normal tabular-nums"
                        >
                          {bucket.length}
                        </span>
                      </h3>
                      {bucket.length === 0 ? (
                        <p className="text-[12px] text-text-2">None</p>
                      ) : (
                        <RuleList
                          rules={bucket}
                          label={`${label} rules`}
                          selectedId={selected?.id ?? null}
                          onSelect={setSelectedId}
                        />
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <RuleList
                rules={rules}
                label="Rules"
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            )}
          </section>

          <section aria-labelledby="channels-heading">
            <h2
              id="channels-heading"
              className="mb-3 text-[16px] font-semibold"
            >
              Notification channels
            </h2>
            {ctrl.channels.loading ? (
              <Skeleton kind="line" />
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Channels">
                {(ctrl.channels.data ?? []).map((channel) => (
                  <li key={channel.id}>
                    <AlertChannelCard
                      channel={channel}
                      onVerify={
                        channel.health === "unverified"
                          ? () => void ctrl.verifyChannel(channel.id)
                          : undefined
                      }
                      onDelete={() => void ctrl.removeChannel(channel.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="triggered-heading">
            <h2
              id="triggered-heading"
              className="mb-3 text-[16px] font-semibold"
            >
              Triggered
            </h2>
            {ctrl.feed.loading ? (
              <Skeleton kind="line" />
            ) : (ctrl.feed.data ?? []).length === 0 ? (
              <p className="text-[13px] text-text-2">
                Quiet — nothing has triggered.
              </p>
            ) : (
              <ul aria-label="Triggered feed">
                {(ctrl.feed.data ?? []).map((event) => (
                  <li key={event.id}>
                    {/* clicking an active alert opens declare-incident
                        prefilled (pages.md B9 [Directive]) */}
                    <AlertFeedRow
                      event={event}
                      onClick={
                        event.sev === "resolved"
                          ? undefined
                          : () => setDeclareFrom(event)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section
          aria-labelledby="editor-heading"
          className="min-w-0 rounded-(--radius) border border-border bg-bg-elev p-5"
        >
          {selected ? (
            <>
              <h2
                id="editor-heading"
                className="mb-4 text-[16px] font-semibold"
              >
                Edit rule — {selected.name}
              </h2>
              <RuleEditor
                key={selected.id}
                signal={selected.signal}
                initial={selected}
                channels={ctrl.channels.data ?? []}
                saving={saving}
                onSave={save}
                onTest={() => void runTest()}
                testing={testing}
                queryOptions={rules
                  .filter((r) => r.signal === selected.signal)
                  .map((r) => r.query_string)}
                replay={
                  testResult ? (
                    <ReplayPanel
                      result={testResult}
                      title={`replay — ${selected.name}`}
                    />
                  ) : (
                    <Skeleton kind="panel-axis" style={{ height: 200 }} />
                  )
                }
                error={saveError}
              />
            </>
          ) : (
            <p className="text-[13px] text-text-2">Select a rule to edit it.</p>
          )}
        </section>
      </div>

      <DeclareIncidentModal
        open={declareFrom !== null}
        onClose={() => setDeclareFrom(null)}
        initialTitle={
          declareFrom
            ? `${declareFrom.monitor_name} — ${declareFrom.message}`
            : ""
        }
        initialSev={declareFrom?.sev === "sev1" ? "1" : "2"}
      />
    </div>
  );
}

/** The rules list body — shared by the flat and grouped (B8) views. */
function RuleList({
  rules,
  label,
  selectedId,
  onSelect,
}: {
  rules: AlertRule[];
  label: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-3" aria-label={label}>
      {rules.map((rule) => (
        <li key={rule.id} data-testid={`rule-${rule.id}`}>
          <AlertRuleCard
            rule={rule}
            onClick={() => onSelect(rule.id)}
            className={selectedId === rule.id ? "border-brand" : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
