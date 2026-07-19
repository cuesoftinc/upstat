"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AlertSignal, MonitorType } from "@/models";
import { useAlertsController } from "@/controllers/alerts";
import { useMonitorsController } from "@/controllers/monitors";
import { RuleEditor, SIGNAL_LABELS, type RuleInput } from "../rule-editor";

const SIGNALS: AlertSignal[] = ["uptime", "metric", "log", "trace", "slo_burn"];

/**
 * B8 create-monitor (Figma 172:5332) — monitor type picker → rule editor
 * as a dedicated create screen; the uptime signal defines an HTTP check
 * (the B7 coexistence contract).
 */
export default function NewMonitorPage() {
  const router = useRouter();
  const alerts = useAlertsController();
  const monitors = useMonitorsController();
  // reactive search params — reading window.location races client navigation
  const signalParam = useSearchParams().get("signal");
  const [signal, setSignal] = useState<AlertSignal>(
    SIGNALS.includes(signalParam as AlertSignal) ? (signalParam as AlertSignal) : "uptime",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // uptime-check form state (Figma "Define check")
  const [checkName, setCheckName] = useState("");
  const [url, setUrl] = useState("");
  const [checkType, setCheckType] = useState<string | null>("api");
  const [interval, setIntervalSec] = useState<string | null>("60");

  const createRule = async (input: RuleInput) => {
    setSaving(true);
    setError(null);
    try {
      await alerts.createRule(input);
      router.push("/dashboard/monitors");
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not create the rule");
      setSaving(false);
    }
  };

  const createCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const monitor = await monitors.create({
        name: checkName.trim(),
        target: url.trim(),
        type: (checkType ?? "api") as MonitorType,
        interval_seconds: Number(interval ?? 60),
      });
      router.push(`/dashboard/uptime/${monitor.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create the check");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="new-monitor-page">
      <h1 className="text-[20px] font-semibold">Create monitor</h1>

      {/* monitor type picker */}
      <nav aria-label="Monitor type" className="flex flex-wrap gap-2">
        {SIGNALS.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`signal-${s}`}
            aria-pressed={signal === s}
            onClick={() => setSignal(s)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-[var(--duration-fast)]",
              signal === s
                ? "border-brand text-brand"
                : "border-border text-text-2 hover:text-text",
            )}
          >
            {SIGNAL_LABELS[s]}
          </button>
        ))}
      </nav>

      <section
        aria-labelledby="define-heading"
        className="rounded-(--radius) border border-border bg-bg-elev p-5"
      >
        <h2 id="define-heading" className="mb-4 text-[16px] font-semibold">
          {signal === "uptime" ? "Define check" : `Define rule — ${SIGNAL_LABELS[signal]}`}
        </h2>

        {signal === "uptime" ? (
          <form onSubmit={createCheck} className="flex max-w-2xl flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">Check type</span>
                <Select
                  options={[
                    { value: "api", label: "HTTP" },
                    { value: "website", label: "Website" },
                    { value: "server", label: "Server" },
                  ]}
                  value={checkType}
                  onValueChange={setCheckType}
                  aria-label="Check type"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">URL</span>
                <Input mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.cuesoft.io/healthz" data-testid="check-url" />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">Name</span>
                <Input value={checkName} onChange={(e) => setCheckName(e.target.value)} placeholder="api.cuesoft.io heartbeat" data-testid="check-name" />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-text-2">Interval</span>
                <Select
                  options={[
                    { value: "30", label: "30s" },
                    { value: "60", label: "60s" },
                    { value: "300", label: "5m" },
                  ]}
                  value={interval}
                  onValueChange={setIntervalSec}
                  aria-label="Interval"
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-crit">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !checkName.trim() || !url.trim()} data-testid="create-monitor">
                {saving ? "Creating…" : "Create monitor"}
              </Button>
              <Button kind="quiet" type="button" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <RuleEditor
            key={signal}
            signal={signal}
            channels={alerts.channels.data ?? []}
            saving={saving}
            onSave={createRule}
            error={error}
          />
        )}
      </section>
    </div>
  );
}
