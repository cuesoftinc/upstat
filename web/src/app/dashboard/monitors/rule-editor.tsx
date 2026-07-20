"use client";

/**
 * RuleEditor — the B8 signal-generic rule form, composed per the frame
 * (130:2621, adjudicated 2026-07-20): Query as a mono Select over the
 * org's known queries (edit) beside Rule name; the MI-9 test replay
 * INLINE under "Thresholds · test replay" (not hidden behind Test rule);
 * mute switch with the "cooldown 15m · renotify 30m · eval window 5m"
 * caption where the cooldown/renotify Selects used to be. warn/crit
 * threshold inputs and the notification-channel checkboxes are kept as
 * function-preserving extensions beyond the frame (the thresholds feed
 * the replay bands; channels feed notify wiring). Save + Test rule.
 */

import { useState, type ReactNode } from "react";
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
  {
    name: string;
    query_string: string;
    warn: number | null;
    crit: number;
    window: string;
  }
> = {
  uptime: {
    name: "Uptime check",
    query_string: "check:homepage | rate()",
    warn: null,
    crit: 1,
    window: "3 checks",
  },
  metric: {
    name: "API latency high",
    query_string: "metric:http.request.duration_ms service:api-common | p95()",
    warn: 400,
    crit: 500,
    window: "5m",
  },
  log: {
    name: "Error log spike",
    query_string: "service:checkout level:ERROR | count()",
    warn: 50,
    crit: 100,
    window: "5m",
  },
  trace: {
    name: "Trace latency regression",
    query_string:
      "service:ingest-gw trace.duration_ms:>250 | p95(trace.duration_ms)",
    warn: 400,
    crit: 900,
    window: "10m",
  },
  slo_burn: {
    name: "SLO fast burn",
    query_string: "slo:checkout-latency | burn_rate()",
    warn: 6,
    crit: 14.4,
    window: "2h",
  },
};

export type RuleInput = Omit<
  AlertRule,
  "id" | "org_id" | "state" | "last_triggered_at"
>;

export interface RuleEditorProps {
  signal: AlertSignal;
  initial?: AlertRule | null;
  channels: AlertChannel[];
  saving?: boolean;
  onSave: (input: RuleInput) => Promise<void> | void;
  /** MI-9 — present only when the rule already exists. */
  onTest?: () => void;
  testing?: boolean;
  /**
   * Known query strings for the mono Query Select (frame 130:2621).
   * Editing renders a Select over these + the rule's own query; without
   * an existing rule (create flow) the query stays a free-text Input.
   */
  queryOptions?: string[];
  /** Inline MI-9 replay rendering (ReplayPanel), slotted by the page. */
  replay?: ReactNode;
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
  queryOptions = [],
  replay,
  error = null,
}: RuleEditorProps) {
  const defaults = SIGNAL_DEFAULTS[signal];
  const [name, setName] = useState(initial?.name ?? defaults.name);
  const [query, setQuery] = useState(
    initial?.query_string ?? defaults.query_string,
  );
  const [warn, setWarn] = useState<string>(
    String(initial?.thresholds.warn ?? defaults.warn ?? ""),
  );
  const [crit, setCrit] = useState<string>(
    String(initial?.thresholds.crit ?? defaults.crit),
  );
  const [window_, setWindow] = useState<string | null>(
    initial?.thresholds.window ?? defaults.window,
  );
  const [channelIds, setChannelIds] = useState<string[]>(
    initial?.notify.channel_ids ?? [],
  );
  // cooldown/renotify render as the frame's caption (not editable inline);
  // saving passes the rule's current values through unchanged
  const cooldown = initial?.notify.cooldown_minutes ?? 15;
  const renotify = initial?.notify.renotify_minutes ?? 30;
  const [muted, setMuted] = useState(
    (initial?.notify.mute_windows.length ?? 0) > 0,
  );

  // the mono Query Select's option set: known queries + the rule's own
  const querySelectOptions = Array.from(new Set([query, ...queryOptions])).map(
    (q) => ({ value: q, label: q }),
  );

  const toggleChannel = (id: string) => {
    setChannelIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
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
        cooldown_minutes: cooldown,
        renotify_minutes: renotify,
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
      className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"
      data-testid="rule-editor"
    >
      {/* left column (frame 130:2621): Query + the inline test replay */}
      <div className="flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Query</span>
          {initial ? (
            // editing: a mono Select over the org's known queries
            <Select
              options={querySelectOptions}
              value={query}
              onValueChange={setQuery}
              aria-label="Query"
              className="font-data"
            />
          ) : (
            <Input
              mono
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="rule-query"
            />
          )}
        </label>

        {replay !== undefined && (
          <section
            aria-label="Thresholds · test replay"
            className="flex min-w-0 flex-col gap-2"
            data-testid="rule-replay"
          >
            <p className="text-[13px] text-text-2">
              Thresholds · test replay (last 24h)
            </p>
            {replay}
          </section>
        )}
      </div>

      {/* right column: name, thresholds, channels, mute + caption, CTAs */}
      <div className="flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Rule name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="rule-name"
          />
        </label>

        {/* min-w-0 beats the UA fieldset min-inline-size:min-content (390) */}
        <fieldset className="grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-3">
          <legend className="mb-1 text-[13px] text-text-2">
            Thresholds · evaluation window
          </legend>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-warn">warn &gt;</span>
            <Input
              mono
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
              placeholder="—"
              data-testid="rule-warn"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-crit">crit &gt;</span>
            <Input
              mono
              value={crit}
              onChange={(e) => setCrit(e.target.value)}
              data-testid="rule-crit"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">window</span>
            <Select
              options={["3 checks", "5m", "10m", "30m", "1h", "2h"].map(
                (w) => ({
                  value: w,
                  label: w,
                }),
              )}
              value={window_}
              onValueChange={setWindow}
              aria-label="Evaluation window"
            />
          </label>
        </fieldset>

        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-1 text-[13px] text-text-2">
            Notification channels
          </legend>
          <ul className="flex flex-col gap-1.5">
            {channels.map((ch) => (
              <li key={ch.id} className="flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={channelIds.includes(ch.id)}
                  onCheckedChange={() => toggleChannel(ch.id)}
                  aria-label={`Notify ${ch.target}`}
                />
                <span className="font-data min-w-0 truncate text-text-2">
                  {ch.target}
                </span>
                {ch.health !== "verified" && (
                  <span className="text-[11px] text-warn">({ch.health})</span>
                )}
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-[13px] text-text-2">
            <Switch
              checked={muted}
              onCheckedChange={setMuted}
              aria-label="Mute weekends"
            />
            Mute weekends
          </label>
          {/* frame caption — cooldown/renotify read as policy, not inline
              Selects; eval window mirrors the Select above */}
          <p className="text-[12px] text-text-2">
            cooldown {cooldown}m · renotify{" "}
            {renotify === 0 ? "off" : `${renotify}m`} · eval window{" "}
            {window_ ?? "5m"}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={saving || !name.trim() || !crit.trim()}
            data-testid="save-rule"
          >
            {saving ? "Saving…" : "Save rule"}
          </Button>
          {onTest && (
            <Button
              kind="quiet"
              type="button"
              onClick={onTest}
              disabled={testing}
              data-testid="test-rule"
            >
              {testing ? "Replaying…" : "Test rule"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
