import type { QueryAst, Series } from "./query";

/** Alerting — data-model.md §5 MONITOR_RULE / §2 ALERT_CHANNEL; pages.md B8. */

export type AlertSignal = "uptime" | "metric" | "log" | "trace" | "slo_burn";

export type ChannelKind = "email" | "webhook";
export type ChannelHealth = "unverified" | "verified" | "degraded";

export interface AlertChannel {
  id: string;
  kind: ChannelKind;
  /** Friendly display name ("Slack #incidents webhook") — the card's lead
   *  line per the AlertChannelCard master; falls back to the kind label. */
  name?: string;
  /** email address or webhook URL (display form). */
  target: string;
  health: ChannelHealth;
  /** Degraded-state caption ("Last delivery failed 12m ago — 3 retries
   *  exhausted") — rendered only while health = degraded (master anatomy). */
  failure_note?: string;
  created_at: string;
}

export interface AlertThresholds {
  warn: number | null;
  crit: number;
  /** Evaluation window, e.g. `5m`. */
  window: string;
}

export interface AlertNotify {
  channel_ids: string[];
  cooldown_minutes: number;
  /** 0 = off (default). */
  renotify_minutes: number;
  mute_windows: { from: string; to: string }[];
}

export type AlertRuleState = "ok" | "warn" | "alert" | "nodata";

/** Signal-generic monitor rule (persists the AST — query-grammar.md §4). */
export interface AlertRule {
  id: string;
  org_id: string;
  name: string;
  signal: AlertSignal;
  query: QueryAst;
  query_string: string;
  thresholds: AlertThresholds;
  notify: AlertNotify;
  state: AlertRuleState;
  last_triggered_at: string | null;
}

/**
 * MI-9 test replay — `POST /v1/rules/{id}/test` (and the uptime-monitor
 * variant): the last 24h re-evaluated against the thresholds, returning
 * trigger bands + would-have-fired markers for the ThresholdOverlay.
 */
export interface RuleTestResult {
  query_string: string;
  thresholds: AlertThresholds;
  /** 24h replay series (first series is the evaluated one). */
  series: Series[];
  step: string;
  /** Contiguous threshold breaches, band-tinted warn/crit. */
  bands: { level: "warn" | "crit"; from: string; to: string }[];
  /** Would-have-fired timestamps (crit-band starts, cooldown-degated). */
  markers: string[];
  would_have_fired: number;
}

export type AlertEventSev = "sev1" | "sev2" | "resolved";

/** Triggered-feed row (MI-14; AlertFeedRow contract — third tint is `resolved`). */
export interface AlertEvent {
  id: string;
  ts: string;
  sev: AlertEventSev;
  rule_id: string;
  monitor_name: string;
  message: string;
  unread: boolean;
}
