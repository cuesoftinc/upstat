"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QueryPill } from "@/components/ui/QueryPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { useRuleController } from "@/controllers/alerts";
import { splitQuery } from "@/controllers/explorer";
import { ReplayPanel } from "../../replay-panel";

/**
 * B8 rule detail — the MI-9 test-replay frame (Figma 174:6022): trigger
 * bands + would-have-fired markers over the last 24h, with the firing
 * summary and edit/save affordances.
 */
export default function RuleReplayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { rules, rule, testResult, testing, runTest } = useRuleController(id);
  const [toast, setToast] = useState<string | null>(null);

  // the replay runs on entry — this screen IS the replay frame
  useEffect(() => {
    if (rule && !testResult && !testing) void runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per rule
  }, [rule?.id]);

  useEffect(() => {
    if (testResult) setToast(`Replay complete — ${testResult.would_have_fired} firings in the last 24h`);
  }, [testResult]);

  if (rules.loading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-72" />
        <Skeleton kind="panel-axis" style={{ height: 240 }} />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="px-6 py-5">
        <p className="text-[13px] text-text-2">
          Rule not found.{" "}
          <Link href="/dashboard/monitors" className="text-brand hover:underline">
            Back to monitors
          </Link>
        </p>
      </div>
    );
  }

  const { pills } = splitQuery(rule.query_string);

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="rule-replay-page">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold">Monitor rule — test replay</h1>
        {toast && <Toast kind="success" message={toast} onDismiss={() => setToast(null)} />}
      </header>

      <ul aria-label="Rule query" className="flex flex-wrap items-center gap-2">
        {pills.map((p, i) => (
          <li key={i}>
            <QueryPill facet={p.facet} value={p.value} negated={p.negated} />
          </li>
        ))}
        <li className="font-data text-[12px] text-text-2">{rule.query_string.split("|")[1] ?? ""}</li>
      </ul>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <section aria-label="Replay chart">
          {testResult ? (
            <ReplayPanel result={testResult} title={rule.name} />
          ) : (
            <Skeleton kind="panel-axis" style={{ height: 240 }} />
          )}
        </section>

        <section
          aria-labelledby="replay-summary-heading"
          className="rounded-(--radius) border border-border bg-bg-elev p-5"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 id="replay-summary-heading" className="text-[16px] font-semibold">
              Replay — last 24h
            </h2>
            {testResult && (
              <span className="rounded-full border border-warn px-2.5 py-0.5 text-[12px] text-warn">
                would have fired ×{testResult.would_have_fired}
              </span>
            )}
          </header>

          {testResult ? (
            testResult.markers.length === 0 ? (
              <p className="text-[13px] text-text-2">
                No firings — the thresholds held for the entire window.
              </p>
            ) : (
              <ol className="font-data flex flex-col gap-1.5 text-[13px] text-text">
                {testResult.markers.map((ts) => (
                  <li key={ts}>
                    {ts.slice(11, 16)} — crossed crit {testResult.thresholds.crit} → would fire
                  </li>
                ))}
              </ol>
            )
          ) : (
            <Skeleton kind="line" />
          )}

          <p className="mt-4 text-[12px] text-text-2">
            evaluation window {rule.thresholds.window} · cooldown{" "}
            {rule.notify.cooldown_minutes}m ·{" "}
            {rule.notify.mute_windows.length > 0 ? "mute windows active" : "no mute windows active"}
          </p>
          <p className="mt-1 text-[12px] text-text-2">
            notifications: {rule.notify.channel_ids.length} channel
            {rule.notify.channel_ids.length === 1 ? "" : "s"}
          </p>

          <div className="mt-5 flex gap-2">
            <Button kind="quiet" onClick={() => router.push(`/dashboard/monitors?rule=${rule.id}`)}>
              Edit thresholds
            </Button>
            <Button onClick={() => setToast("Rule saved")} data-testid="save-rule-detail">
              Save rule
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
