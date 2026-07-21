"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { SyntheticStepRow } from "@/components/ui/SyntheticStepRow";
import {
  stepSummary,
  type BrowserCheckConfig,
  type HttpStepMethod,
  type MonitorType,
  type SyntheticCheck,
  type SyntheticCheckKind,
  type SyntheticStepInput,
  type SyntheticStepKind,
} from "@/models";
import { useMonitorsController } from "@/controllers/monitors";
import { useSyntheticsController } from "@/controllers/synthetics";

const VIEWPORT_OPTIONS = [
  { value: "1440x900", label: "1440 × 900 (desktop)" },
  { value: "768x1024", label: "768 × 1024 (tablet)" },
  { value: "390x844", label: "390 × 844 (mobile)" },
];

type BuilderTab = "http" | SyntheticCheckKind;

/** Stored steps → builder-editable inputs. */
function toInputs(check: SyntheticCheck): SyntheticStepInput[] {
  return check.steps.map((s) =>
    s.kind === "http"
      ? { kind: "http", method: s.method ?? "GET", url: s.url ?? "" }
      : s.kind === "assertion"
        ? { kind: "assertion", expression: s.expression ?? "" }
        : { kind: "wait", wait_ms: s.wait_ms ?? 500 },
  );
}

/**
 * B7 synthetic check builder (Figma "B7 — Synthetic check builder
 * (multi-step)") — type tabs HTTP / Multi-step / Browser; the multi-step
 * form composes SyntheticStepRow steps (add / reorder / delete) beside the
 * browser-check panel (URL · viewport Select · screenshot-on-failure
 * Switch). The HTTP tab stays the classic single-URL Monitor create.
 */
export function SyntheticCheckBuilder({
  editing,
}: {
  editing?: SyntheticCheck;
}) {
  const router = useRouter();
  const monitors = useMonitorsController();
  const synthetics = useSyntheticsController();

  const [tab, setTab] = useState<BuilderTab>(editing?.kind ?? "multi_step");
  const [name, setName] = useState(editing?.name ?? "");
  const [steps, setSteps] = useState<SyntheticStepInput[]>(
    editing ? toInputs(editing) : [],
  );
  const [browserOn, setBrowserOn] = useState(
    editing ? editing.browser !== null : true,
  );
  const [browser, setBrowser] = useState<BrowserCheckConfig>(
    editing?.browser ?? {
      url: "",
      viewport: "1440x900",
      screenshot_on_failure: true,
    },
  );
  // classic HTTP check fields (Monitor create)
  const [httpTarget, setHttpTarget] = useState("");
  const [httpType, setHttpType] = useState<string | null>("website");
  const [httpInterval, setHttpInterval] = useState<string | null>("60");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | null>(null);

  /* ---------------- steps: add / reorder / delete ---------------- */

  const [draftKind, setDraftKind] = useState<SyntheticStepKind>("http");
  const [draftMethod, setDraftMethod] = useState<HttpStepMethod>("GET");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftExpression, setDraftExpression] = useState("");
  const [draftWaitMs, setDraftWaitMs] = useState("500");

  const addStep = () => {
    const step: SyntheticStepInput =
      draftKind === "http"
        ? { kind: "http", method: draftMethod, url: draftUrl.trim() }
        : draftKind === "assertion"
          ? { kind: "assertion", expression: draftExpression.trim() }
          : { kind: "wait", wait_ms: Number(draftWaitMs) };
    setSteps((prev) => [...prev, step]);
    setDraftUrl("");
    setDraftExpression("");
  };

  const draftValid =
    draftKind === "http"
      ? /^https?:\/\/.+/.test(draftUrl.trim())
      : draftKind === "assertion"
        ? draftExpression.trim().length > 0
        : Number(draftWaitMs) > 0;

  const move = (index: number, delta: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  // pointer drag (HTML5 dnd) — keyboard reorder lives on the row grip
  const dragFrom = useRef<number | null>(null);
  const dropAt = (index: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === index) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  /* ---------------- submit ---------------- */

  const kind: SyntheticCheckKind = tab === "browser" ? "browser" : "multi_step";
  const payload = () => ({
    name: name.trim(),
    kind,
    steps: tab === "browser" ? [] : steps,
    browser: tab === "browser" || browserOn ? browser : null,
  });

  const saveCheck = async (): Promise<SyntheticCheck | null> => {
    setError(null);
    try {
      return editing
        ? await synthetics.update(editing.id, payload())
        : await synthetics.create(payload());
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save the check");
      return null;
    }
  };

  const onSave = async () => {
    setBusy("save");
    try {
      if (tab === "http") {
        const monitor = await monitors.create({
          name: name.trim(),
          target: httpTarget.trim(),
          type: (httpType ?? "website") as MonitorType,
          interval_seconds: Number(httpInterval ?? 60),
        });
        router.push(`/dashboard/uptime/${monitor.id}`);
        return;
      }
      const check = await saveCheck();
      if (check) router.push("/dashboard/uptime");
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save the check");
    } finally {
      setBusy(null);
    }
  };

  const onRunOnce = async () => {
    setBusy("run");
    try {
      const check = await saveCheck();
      if (!check) return;
      const run = await synthetics.runOnce(check.id);
      router.push(`/dashboard/uptime/checks/${check.id}?run=${run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not run the check");
    } finally {
      setBusy(null);
    }
  };

  const saveDisabled =
    busy !== null ||
    !name.trim() ||
    (tab === "http"
      ? !httpTarget.trim()
      : tab === "multi_step"
        ? steps.length === 0
        : !/^https?:\/\/.+/.test(browser.url));

  const browserPanel = (
    <aside
      aria-labelledby="browser-check-heading"
      className="flex h-fit w-full flex-col gap-4 rounded-(--radius) border border-border bg-bg-elev p-5 xl:max-w-[620px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="browser-check-heading" className="text-[16px] font-semibold">
          Browser check
        </h2>
        {tab === "multi_step" && (
          <Switch
            checked={browserOn}
            onCheckedChange={setBrowserOn}
            aria-label="Run in a browser"
          />
        )}
      </div>
      {(tab === "browser" || browserOn) && (
        <>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">URL</span>
            <Input
              mono
              value={browser.url}
              onChange={(e) => setBrowser({ ...browser, url: e.target.value })}
              placeholder="https://upstat.cuesoft.io/checkout"
              data-testid="browser-url"
            />
          </label>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-text-2">Viewport</span>
            <Select
              options={VIEWPORT_OPTIONS}
              value={browser.viewport}
              onValueChange={(v) => setBrowser({ ...browser, viewport: v })}
              aria-label="Viewport"
              className="min-w-48"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-text">Screenshot on failure</span>
            <Switch
              checked={browser.screenshot_on_failure}
              onCheckedChange={(v) =>
                setBrowser({ ...browser, screenshot_on_failure: v })
              }
              aria-label="Screenshot on failure"
            />
          </div>
          <p className="text-[12px] leading-[1.45] text-text-2">
            Runs in a headless browser on the check schedule.
          </p>
        </>
      )}
    </aside>
  );

  return (
    <div
      className="flex flex-col gap-5 px-6 py-5"
      data-testid="synthetic-builder"
    >
      <h1 className="text-[20px] font-semibold">
        {editing ? "Edit synthetic check" : "Create synthetic check"}
      </h1>

      {!editing && (
        <div role="tablist" aria-label="Check type" className="flex gap-2">
          {(
            [
              ["http", "HTTP"],
              ["multi_step", "Multi-step"],
              ["browser", "Browser"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setError(null); // stale API errors don't outlive the tab
              }}
              data-testid={`check-kind-${value}`}
              className={
                tab === value
                  ? "rounded-(--radius) border border-brand px-3 py-1.5 text-[13px] font-medium text-brand-text"
                  : "rounded-(--radius) border border-border px-3 py-1.5 text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <label className="flex w-full max-w-[640px] flex-col gap-1 text-[13px]">
        <span className="text-text-2">Check name</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="checkout flow — api + web"
          data-testid="synthetic-name"
        />
      </label>

      <div className="flex flex-col gap-6 xl:flex-row">
        {tab === "http" && (
          <section
            aria-label="HTTP check"
            className="flex w-full max-w-[640px] flex-col gap-4"
          >
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">URL</span>
              <Input
                mono
                value={httpTarget}
                onChange={(e) => setHttpTarget(e.target.value)}
                placeholder="https://api.cuesoft.io/healthz"
                data-testid="http-target"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">Check type</span>
                <Select
                  options={[
                    { value: "website", label: "Website" },
                    { value: "api", label: "API" },
                    { value: "server", label: "Server" },
                  ]}
                  value={httpType}
                  onValueChange={setHttpType}
                  aria-label="Check type"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">Interval</span>
                <Select
                  options={[
                    { value: "30", label: "30s" },
                    { value: "60", label: "60s" },
                    { value: "300", label: "5m" },
                  ]}
                  value={httpInterval}
                  onValueChange={setHttpInterval}
                  aria-label="Interval"
                />
              </label>
            </div>
          </section>
        )}

        {tab === "multi_step" && (
          <section
            aria-labelledby="steps-heading"
            className="flex w-full max-w-[640px] flex-col gap-3"
          >
            <h2 id="steps-heading" className="text-[16px] font-semibold">
              Steps
            </h2>
            {steps.length === 0 ? (
              <p className="text-[13px] text-text-2">
                No steps yet — add an HTTP request, an assertion or a wait.
              </p>
            ) : (
              <ol aria-label="Check steps" className="flex flex-col gap-2">
                {steps.map((step, i) => (
                  <li
                    key={`${step.kind}-${i}`}
                    draggable
                    onDragStart={() => {
                      dragFrom.current = i;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropAt(i)}
                  >
                    <SyntheticStepRow
                      index={i + 1}
                      kind={step.kind}
                      summary={stepSummary(step)}
                      onDelete={() =>
                        setSteps((prev) => prev.filter((_, j) => j !== i))
                      }
                      onMove={(delta) => move(i, delta)}
                    />
                  </li>
                ))}
              </ol>
            )}

            {/* quiet "Add step" composer */}
            <div className="flex flex-wrap items-end gap-2 rounded-(--radius) border border-dashed border-border p-3">
              <label className="flex flex-col gap-1 text-[12px] text-text-2">
                Step kind
                <Select
                  options={[
                    { value: "http", label: "HTTP request" },
                    { value: "assertion", label: "Assertion" },
                    { value: "wait", label: "Wait" },
                  ]}
                  value={draftKind}
                  onValueChange={(v) => setDraftKind(v as SyntheticStepKind)}
                  aria-label="Step kind"
                  className="min-w-36"
                />
              </label>
              {draftKind === "http" && (
                <>
                  <label className="flex flex-col gap-1 text-[12px] text-text-2">
                    Method
                    <Select
                      options={["GET", "POST", "HEAD"].map((m) => ({
                        value: m,
                        label: m,
                      }))}
                      value={draftMethod}
                      onValueChange={(v) => setDraftMethod(v as HttpStepMethod)}
                      aria-label="Method"
                      className="min-w-24"
                    />
                  </label>
                  <label className="flex min-w-56 flex-1 flex-col gap-1 text-[12px] text-text-2">
                    URL
                    <Input
                      mono
                      value={draftUrl}
                      onChange={(e) => setDraftUrl(e.target.value)}
                      placeholder="https://api.cuesoft.io/health"
                      data-testid="step-url"
                    />
                  </label>
                </>
              )}
              {draftKind === "assertion" && (
                <label className="flex min-w-56 flex-1 flex-col gap-1 text-[12px] text-text-2">
                  Expression
                  <Input
                    mono
                    value={draftExpression}
                    onChange={(e) => setDraftExpression(e.target.value)}
                    placeholder="status == 200 && body.ok == true"
                    data-testid="step-expression"
                  />
                </label>
              )}
              {draftKind === "wait" && (
                <label className="flex flex-col gap-1 text-[12px] text-text-2">
                  Wait (ms)
                  <Input
                    mono
                    type="number"
                    value={draftWaitMs}
                    onChange={(e) => setDraftWaitMs(e.target.value)}
                    className="w-28"
                    data-testid="step-wait-ms"
                  />
                </label>
              )}
              <Button
                kind="quiet"
                size="sm"
                onClick={addStep}
                disabled={!draftValid}
                data-testid="add-step"
              >
                + Add step
              </Button>
            </div>
          </section>
        )}

        {tab !== "http" && browserPanel}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-crit">
          {error}
        </p>
      )}

      <footer className="flex items-center gap-3">
        <Button
          onClick={() => void onSave()}
          disabled={saveDisabled}
          data-testid="save-check"
        >
          {busy === "save"
            ? "Saving…"
            : editing
              ? "Save changes"
              : "Save check"}
        </Button>
        {tab !== "http" && (
          <Button
            kind="quiet"
            onClick={() => void onRunOnce()}
            disabled={saveDisabled}
            data-testid="run-once"
          >
            {busy === "run" ? "Running…" : "Run once"}
          </Button>
        )}
      </footer>
    </div>
  );
}
