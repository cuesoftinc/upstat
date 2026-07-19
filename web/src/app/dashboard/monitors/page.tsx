"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertChannelCard } from "@/components/ui/AlertChannelCard";
import { AlertFeedRow } from "@/components/ui/AlertFeedRow";
import { AlertRuleCard } from "@/components/ui/AlertRuleCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AlertEvent } from "@/models";
import { useAlertsController, useRuleTest } from "@/controllers/alerts";
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
  const ruleParam = useSearchParams().get("rule");
  const [selectedId, setSelectedId] = useState<string | null>(ruleParam);
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
        <Button onClick={() => router.push("/dashboard/monitors/new")} data-testid="new-monitor">
          New monitor
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Monitor rules">
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
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Rules">
                {rules.map((rule) => (
                  <li key={rule.id} data-testid={`rule-${rule.id}`}>
                    <AlertRuleCard
                      rule={rule}
                      onClick={() => setSelectedId(rule.id)}
                      className={selected?.id === rule.id ? "border-brand" : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="channels-heading">
            <h2 id="channels-heading" className="mb-3 text-[16px] font-semibold">
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
            <h2 id="triggered-heading" className="mb-3 text-[16px] font-semibold">
              Triggered
            </h2>
            {ctrl.feed.loading ? (
              <Skeleton kind="line" />
            ) : (ctrl.feed.data ?? []).length === 0 ? (
              <p className="text-[13px] text-text-2">Quiet — nothing has triggered.</p>
            ) : (
              <ul aria-label="Triggered feed">
                {(ctrl.feed.data ?? []).map((event) => (
                  <li key={event.id}>
                    {/* clicking an active alert opens declare-incident
                        prefilled (pages.md B9 [Directive]) */}
                    <AlertFeedRow
                      event={event}
                      onClick={
                        event.sev === "resolved" ? undefined : () => setDeclareFrom(event)
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
              <h2 id="editor-heading" className="mb-4 text-[16px] font-semibold">
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
                error={saveError}
              />
              {testResult && (
                <div className="mt-5" data-testid="rule-replay">
                  <ReplayPanel result={testResult} title={`replay — ${selected.name}`} />
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-text-2">Select a rule to edit it.</p>
          )}
        </section>
      </div>

      <DeclareIncidentModal
        open={declareFrom !== null}
        onClose={() => setDeclareFrom(null)}
        initialTitle={declareFrom ? `${declareFrom.monitor_name} — ${declareFrom.message}` : ""}
        initialSev={declareFrom?.sev === "sev1" ? "1" : "2"}
      />
    </div>
  );
}
