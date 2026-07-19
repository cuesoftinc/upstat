"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SLOCard } from "@/components/ui/SLOCard";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SliSource } from "@/models";
import { useMonitorsController } from "@/controllers/monitors";
import { useSlosController } from "@/controllers/slos";

const WINDOWS = ["30d", "7d", "90d"];

/**
 * B10 SLOs (Figma 131:3110) — SLOCard grid (healthy/burning/exhausted,
 * MI-15) + the Define SLO panel (SLI source · target · rolling window).
 */
export default function SlosPage() {
  const { data, loading, create } = useSlosController();
  const monitors = useMonitorsController();
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState("99.9");
  const [window_, setWindow] = useState("30d");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defineOpen, setDefineOpen] = useState(true);

  const sourceOptions = [
    ...(monitors.data ?? [])
      .filter((m) => m.active)
      .map((m) => ({
        value: `check:${m.name}`,
        label: `uptime check: ${m.name}`,
      })),
    {
      value: "metric_ratio:good/total",
      label: "metric ratio: good ÷ total events",
    },
    { value: "latency:p95<800ms", label: "latency: p95 under threshold" },
  ];

  const submit = async () => {
    if (!source) {
      setError("Pick an SLI source.");
      return;
    }
    const targetNum = Number(target.replace("%", ""));
    if (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum >= 100) {
      setError("Target must be a percentage below 100, e.g. 99.9.");
      return;
    }
    const [kind, name] = source.split(":");
    setCreating(true);
    setError(null);
    try {
      await create({
        name:
          kind === "check"
            ? `${name} availability`
            : kind === "latency"
              ? `Latency SLO (${name})`
              : `Ratio SLO (${name})`,
        sli_source: kind as SliSource,
        target: targetNum,
        window: window_,
      });
      setSource(null);
      setTarget("99.9");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the SLO.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div data-testid="slos" className="flex flex-col gap-6 px-6 py-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">SLOs</h1>
        <Button onClick={() => setDefineOpen(true)} data-testid="new-slo">
          New SLO
        </Button>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} kind="value" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <section
          aria-label="No SLOs"
          className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] leading-[1.45] text-text-2"
        >
          No SLOs yet — define one below; burn-rate monitors are one click away
          once it exists.
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((slo) => (
            <li key={slo.id} className="min-w-0">
              <SLOCard slo={slo} />
            </li>
          ))}
        </ul>
      )}

      {defineOpen && (
        <section
          aria-labelledby="define-slo-heading"
          className="flex flex-col gap-4 rounded-(--radius) border border-border bg-bg-elev p-5"
        >
          <h2 id="define-slo-heading" className="text-[16px] font-semibold">
            Define SLO
          </h2>
          <form
            className="grid items-end gap-4 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">SLI source</span>
              <Select
                options={sourceOptions}
                value={source}
                onValueChange={setSource}
                placeholder="pick a signal…"
                aria-label="SLI source"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Target</span>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="99.9%"
                aria-label="Target"
                data-testid="slo-target"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Window</span>
              <Select
                options={WINDOWS.map((w) => ({
                  value: w,
                  label: `${w} rolling`,
                }))}
                value={window_}
                onValueChange={setWindow}
                aria-label="Window"
              />
            </label>
            <div className="md:col-span-3">
              {error && (
                <p role="alert" className="mb-2 text-[13px] text-crit">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={creating}
                data-testid="create-slo"
              >
                {creating ? "Creating…" : "Create SLO"}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
