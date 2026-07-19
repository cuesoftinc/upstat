"use client";

/**
 * RuleEditor — the B8 signal-generic rule form (Figma 130:2621): query +
 * thresholds (warn/crit) + evaluation window, notification channels,
 * cooldown/renotify, mute toggle; Save + MI-9 Test rule.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import type { AlertChannel, AlertRule, AlertSignal } from "@/models";

export const SIGNAL_LABELS: Record<AlertSignal, string> = {
  uptime: "Uptime check",
  metric: "Metric threshold",
  log: "Log count / pattern",
  trace: "Trace latency",
  slo_burn: "SLO burn rate",
};

export const SIGNAL_DEFAULTS: Record<
  AlertSignal,
  { name: string; query_string: string; warn: number | null; crit: number; window: string }
> = {
  uptime: { name: "Uptime check", query_string: "check:homepage | rate()", warn: null, crit: 1, window: "3 checks" },
  metric: { name: "API latency high", query_string: "metric:http.request.duration_ms service:api-common | p95()", warn: 400, crit: 500, window: "5m" },
  log: { name: "Error log spike", query_string: "service:checkout level:ERROR | count()", warn: 50, crit: 100, window: "5m" },
  trace: { name: "Trace latency regression", query_string: "service:ingest-gw trace.duration_ms:>250 | p95(trace.duration_ms)", warn: 400, crit: 900, window: "10m" },
  slo_burn: { name: "SLO fast burn", query_string: "slo:checkout-latency | burn_rate()", warn: 6, crit: 14.4, window: "2h" },
};

export type RuleInput = Omit<AlertRule, "id" | "org_id" | "state" | "last_triggered_at">;

export interface RuleEditorProps {
  signal: AlertSignal;
  initial?: AlertRule | null;
  channels: AlertChannel[];
  saving?: boolean;
  onSave: (input: RuleInput) => Promise<void> | void;
  /** MI-9 — present only when the rule already exists. */
  onTest?: () => void;
  testing?: boolean;
  error?: string | null;
}

export function RuleEditor({
  signal,
  initial = null,
  channels,
  saving = false,
  onSave,
  onTest,
  testing = false,
  error = null,
}: RuleEditorProps) {
  const defaults = SIGNAL_DEFAULTS[signal];
  const [name, setName] = useState(initial?.name ?? defaults.name);
  const [query, setQuery] = useState(initial?.query_string ?? defaults.query_string);
  const [warn, setWarn] = useState<string>(String(initial?.thresholds.warn ?? defaults.warn ?? ""));
  const [crit, setCrit] = useState<string>(String(initial?.thresholds.crit ?? defaults.crit));
  const [window_, setWindow] = useState<string | null>(initial?.thresholds.window ?? defaults.window);
  const [channelIds, setChannelIds] = useState<string[]>(initial?.notify.channel_ids ?? []);
  const [cooldown, setCooldown] = useState<string | null>(String(initial?.notify.cooldown_minutes ?? 15));
  const [renotify, setRenotify] = useState<string | null>(String(initial?.notify.renotify_minutes ?? 30));
  const [muted, setMuted] = useState((initial?.notify.mute_windows.length ?? 0) > 0);

  const toggleChannel = (id: string) => {
    setChannelIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const submit = () => {
    void onSave({
      name: name.trim(),
      signal,
      query: initial?.query ?? { v: 1, filters: { op: "and", terms: [] } },
      query_string: query.trim(),
      thresholds: {
        warn: warn.trim() === "" ? null : Number(warn),
        crit: Number(crit),
        window: window_ ?? "5m",
      },
      notify: {
        channel_ids: channelIds,
        cooldown_minutes: Number(cooldown ?? 15),
        renotify_minutes: Number(renotify ?? 0),
        mute_windows: muted
          ? [{ from: "SAT 00:00", to: "MON 00:00" }] // mute weekends
          : [],
      },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
      data-testid="rule-editor"
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Query</span>
          <Input mono value={query} onChange={(e) => setQuery(e.target.value)} data-testid="rule-query" />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Rule name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="rule-name" />
        </label>
      </div>

      {/* min-w-0 beats the UA fieldset min-inline-size:min-content (390) */}
      <fieldset className="grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-3">
        <legend className="mb-1 text-[13px] text-text-2">Thresholds · evaluation window</legend>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-warn">warn &gt;</span>
          <Input mono value={warn} onChange={(e) => setWarn(e.target.value)} placeholder="—" data-testid="rule-warn" />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-crit">crit &gt;</span>
          <Input mono value={crit} onChange={(e) => setCrit(e.target.value)} data-testid="rule-crit" />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">window</span>
          <Select
            options={["3 checks", "5m", "10m", "30m", "1h", "2h"].map((w) => ({ value: w, label: w }))}
            value={window_}
            onValueChange={setWindow}
            aria-label="Evaluation window"
          />
        </label>
      </fieldset>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 text-[13px] text-text-2">Notification channels</legend>
        <ul className="flex flex-col gap-1.5">
          {channels.map((ch) => (
            <li key={ch.id} className="flex items-center gap-2 text-[13px]">
              <Checkbox
                checked={channelIds.includes(ch.id)}
                onCheckedChange={() => toggleChannel(ch.id)}
                aria-label={`Notify ${ch.target}`}
              />
              <span className="font-data min-w-0 truncate text-text-2">{ch.target}</span>
              {ch.health !== "verified" && (
                <span className="text-[11px] text-warn">({ch.health})</span>
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-[13px] text-text-2">
          <Switch checked={muted} onCheckedChange={setMuted} aria-label="Mute weekends" />
          Mute weekends
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-text-2">
          cooldown
          <Select
            options={["5", "10", "15", "30", "60"].map((v) => ({ value: v, label: `${v}m` }))}
            value={cooldown}
            onValueChange={setCooldown}
            aria-label="Cooldown"
            className="min-w-20"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-text-2">
          renotify
          <Select
            options={["0", "15", "30", "60"].map((v) => ({ value: v, label: v === "0" ? "off" : `${v}m` }))}
            value={renotify}
            onValueChange={setRenotify}
            aria-label="Renotify"
            className="min-w-20"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving || !name.trim() || !crit.trim()} data-testid="save-rule">
          {saving ? "Saving…" : "Save rule"}
        </Button>
        {onTest && (
          <Button kind="quiet" type="button" onClick={onTest} disabled={testing} data-testid="test-rule">
            {testing ? "Replaying…" : "Test rule"}
          </Button>
        )}
      </div>
    </form>
  );
}
