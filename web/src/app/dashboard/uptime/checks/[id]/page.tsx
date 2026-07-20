"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { StepResultRow } from "@/components/ui/StepResultRow";
import { UptimeCard } from "@/components/ui/UptimeCard";
import { ageLabel } from "@/controllers/shell";
import { monitorPillStatus } from "@/controllers/monitors";
import {
  useSyntheticContext,
  useSyntheticRunController,
  useSyntheticsController,
} from "@/controllers/synthetics";

function totalLabel(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

/** `1440x900` → `1440 × 900`. */
function viewportLabel(viewport: string): string {
  return viewport.replace("x", " × ");
}

/**
 * B7 synthetic run view (Figma "B7 — Synthetic check run (multi-step
 * results)") — per-step pass/fail timeline (StepResultRow), stop-at-first-
 * failure copy, UptimeCard context and the failure-screenshot card.
 * `?run=` selects a run; the latest renders by default.
 */
export default function SyntheticRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const runId = useSearchParams().get("run");
  const { check, runs, selected, notFound } = useSyntheticRunController(
    id,
    runId,
  );
  const context = useSyntheticContext(check.data);
  const synthetics = useSyntheticsController();

  if (check.loading || runs.loading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-72" />
        <Skeleton kind="panel-axis" style={{ height: 260 }} />
      </div>
    );
  }
  if (!check.data) {
    return (
      <div className="px-6 py-5">
        <p className="text-[13px] text-text-2">
          This synthetic check no longer exists.
        </p>
      </div>
    );
  }

  const c = check.data;
  const run = selected;
  const maxMs = Math.max(...(run?.steps ?? []).map((s) => s.duration_ms), 1);
  const notRunFrom = run ? run.steps.length + 1 : 0;
  const notRunCopy =
    run && run.status === "fail" && notRunFrom <= run.steps_total
      ? notRunFrom === run.steps_total
        ? `Step ${notRunFrom} not run — the check stops at the first failure.`
        : `Steps ${notRunFrom}–${run.steps_total} not run — the check stops at the first failure.`
      : null;

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="synthetic-run">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold">
          {c.name}
          {run ? ` · run #${run.number}` : ""}
        </h1>
        <Link
          href={`/dashboard/uptime/checks/${c.id}/edit`}
          className="text-[13px] text-text-2 underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:text-text hover:underline"
          data-testid="edit-check"
        >
          Edit check
        </Link>
        <Button
          kind="quiet"
          size="sm"
          className="ml-auto"
          onClick={() =>
            void synthetics.runOnce(c.id).then((r) => {
              router.push(`/dashboard/uptime/checks/${c.id}?run=${r.id}`);
              void runs.reload();
            })
          }
          data-testid="run-once"
        >
          Run once
        </Button>
      </header>

      {run ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              status={run.status === "pass" ? "ok" : "crit"}
              label={run.status === "pass" ? "PASS" : "FAIL"}
            />
            <span className="font-data text-[12px] text-text-2">
              ran {ageLabel(run.started_at)} ago · {totalLabel(run.total_ms)}{" "}
              total
              {run.status === "fail" ? " · stopped at first failure" : ""}
            </span>
          </div>

          {context.monitor && context.history.data && (
            <section
              aria-label={`${context.monitor.name} uptime context`}
              className="max-w-[420px]"
            >
              <UptimeCard
                name={context.monitor.name}
                days={context.history.data.days}
                uptimePct={context.history.data.uptime_90d_pct}
                p95Ms={context.monitor.last_response_time_ms ?? undefined}
                status={monitorPillStatus(context.monitor.status)}
              />
            </section>
          )}

          <div className="flex flex-col gap-6 xl:flex-row">
            <section
              aria-labelledby="run-steps-heading"
              className="w-full max-w-[880px]"
            >
              <h2
                id="run-steps-heading"
                className="mb-3 text-[16px] font-semibold"
              >
                Steps
              </h2>
              <ol aria-label="Step results">
                {run.steps.map((step) => (
                  <li key={step.index}>
                    <StepResultRow
                      index={step.index}
                      kind={step.kind}
                      summary={step.summary}
                      result={step.status}
                      durationMs={step.duration_ms}
                      durationFraction={step.duration_ms / maxMs}
                    />
                  </li>
                ))}
              </ol>
              {notRunCopy && (
                <p className="mt-2 text-[12px] text-text-2">{notRunCopy}</p>
              )}
            </section>

            {run.failure_screenshot && (
              <aside
                aria-label="Failure screenshot"
                className="flex h-fit w-full max-w-[390px] flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-4"
                data-testid="failure-screenshot"
              >
                {/* seeded placeholder frame — the mock captures no real
                    pixels; the card is the contract (Figma 330:12405) */}
                <div className="aspect-[16/10] w-full rounded-(--radius) bg-nodata/20" />
                <p className="text-[12px] text-text-2">
                  Failure screenshot — step {run.failure_screenshot.step_index}{" "}
                  · viewport {viewportLabel(run.failure_screenshot.viewport)}
                </p>
              </aside>
            )}
          </div>
        </>
      ) : notFound ? (
        // never "No runs yet" while runs exist — a bad ?run= says so
        <p className="text-[13px] text-text-2" data-testid="run-not-found">
          Run {runId} not found — pick one from the run history below.
        </p>
      ) : (
        <p className="text-[13px] text-text-2">
          No runs yet — Run once to execute the steps now.
        </p>
      )}

      <section aria-labelledby="runs-heading" className="max-w-[420px]">
        <h2 id="runs-heading" className="mb-2 text-[16px] font-semibold">
          Runs
        </h2>
        <ul aria-label="Run history" className="flex flex-col">
          {(runs.data ?? []).map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/uptime/checks/${c.id}?run=${r.id}`}
                className="flex h-9 items-center gap-3 border-b border-border px-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
                aria-current={run?.id === r.id ? "true" : undefined}
              >
                <StatusPill
                  status={r.status === "pass" ? "ok" : "crit"}
                  dotOnly
                />
                <span className="font-data text-[13px] text-text">
                  #{r.number}
                </span>
                <span className="font-data ml-auto text-[12px] text-text-2">
                  {ageLabel(r.started_at)} ago · {totalLabel(r.total_ms)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
