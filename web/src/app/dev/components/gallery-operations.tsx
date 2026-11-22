import { useState } from "react";
import type {
  AlertChannel,
  AlertEvent,
  AlertRule,
  ApiKey,
  ErrorGroup,
  Member,
  ServiceCatalogEntry,
  Slo,
} from "@/models";
import { AlertChannelCard } from "@/components/ui/AlertChannelCard";
import {
  AlertFeedRow,
  NotificationPopover,
} from "@/components/ui/AlertFeedRow";
import { AlertRuleCard } from "@/components/ui/AlertRuleCard";
import { APIKeyRow } from "@/components/ui/APIKeyRow";
import { DashboardListRow } from "@/components/ui/DashboardListRow";
import { ErrorGroupRow } from "@/components/ui/ErrorGroupRow";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import { IncidentComposer } from "@/components/ui/IncidentComposer";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { Input } from "@/components/ui/Input";
import { LogLine } from "@/components/ui/LogLine";
import { MemberRow } from "@/components/ui/MemberRow";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { ServiceCatalogRow } from "@/components/ui/ServiceCatalogRow";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { SLOCard } from "@/components/ui/SLOCard";
import { type StatusPillStatus } from "@/components/ui/StatusPill";
import { UptimeCard } from "@/components/ui/UptimeCard";
import { SelectDemo, SwitchDemo } from "./gallery-controls";
import { Cell, Section } from "./gallery-layout";
import { STATUSES, DAYS_90, LOG_EVENT } from "./gallery-fixtures";

const SLOS: Slo[] = [
  {
    id: "slo_1",
    org_id: "org",
    name: "API availability",
    sli_source: "check",
    target: 99.9,
    window: "30d",
    current: 99.97,
    budget_remaining_pct: 82,
    burn_rate: 0.4,
    state: "healthy",
  },
  {
    id: "slo_2",
    org_id: "org",
    name: "Checkout p95 < 400 ms",
    sli_source: "latency",
    target: 99.5,
    window: "30d",
    current: 99.41,
    budget_remaining_pct: 23,
    burn_rate: 3.1,
    state: "burning",
  },
  {
    id: "slo_3",
    org_id: "org",
    name: "Ingest success rate",
    sli_source: "metric_ratio",
    target: 99.99,
    window: "7d",
    current: 99.72,
    budget_remaining_pct: 0,
    burn_rate: 6.8,
    state: "exhausted",
  },
];

const CHANNELS: AlertChannel[] = [
  {
    id: "ch_1",
    kind: "webhook",
    target: "https://hooks.slack.com/T042/on-call",
    health: "verified",
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "ch_2",
    kind: "email",
    target: "oncall@upstat.dev",
    health: "unverified",
    created_at: "2026-07-01T00:00:00Z",
  },
  {
    id: "ch_3",
    kind: "webhook",
    target: "https://pager.example.com/hook",
    health: "degraded",
    created_at: "2026-05-12T00:00:00Z",
  },
];

const RULE: AlertRule = {
  id: "rule_1",
  org_id: "org",
  name: "Checkout p95 latency",
  signal: "metric",
  query: { v: 1, filters: { op: "and", terms: [] }, step: "auto" },
  query_string: "metric:http.request.duration_ms service:checkout | p95()",
  thresholds: { warn: 800, crit: 1500, window: "5m" },
  notify: {
    channel_ids: ["ch_1"],
    cooldown_minutes: 10,
    renotify_minutes: 0,
    mute_windows: [],
  },
  state: "alert",
  last_triggered_at: "2026-07-18T09:00:00Z",
};

const ALERT_EVENTS: AlertEvent[] = [
  {
    id: "evt_1",
    ts: "2026-07-18T09:00:00Z",
    sev: "sev1",
    rule_id: "rule_1",
    monitor_name: "Checkout p95 latency",
    message: "p95 2,412 ms breached crit 1,500 ms",
    unread: true,
  },
  {
    id: "evt_2",
    ts: "2026-07-18T08:31:00Z",
    sev: "sev2",
    rule_id: "rule_2",
    monitor_name: "Ingest queue depth",
    message: "queue 940 breached warn 600",
    unread: true,
  },
  {
    id: "evt_3",
    ts: "2026-07-18T07:58:00Z",
    sev: "resolved",
    rule_id: "rule_3",
    monitor_name: "status-page uptime",
    message: "recovered after 4m",
    unread: false,
  },
];

const API_KEYS: ApiKey[] = [
  {
    id: "key_1",
    kind: "ingestion_token",
    name: "prod ingest",
    scope: "otlp",
    key_masked: "uk_live_3f…9c",
    status: "active",
    created_at: "2026-05-01T00:00:00Z",
    rejected_count: 0,
  },
  {
    id: "key_2",
    kind: "ingestion_token",
    name: "legacy ingest",
    scope: "all",
    key_masked: "uk_live_8a…41",
    status: "rotation_grace",
    created_at: "2026-04-01T00:00:00Z",
    rejected_count: 12,
  },
  {
    id: "key_3",
    kind: "property_key",
    name: "upstat.cuesoft.io",
    scope: "rum",
    key_masked: "pk_live_77…e0",
    status: "revoked",
    created_at: "2026-03-01T00:00:00Z",
    rejected_count: 4022,
  },
];

const MEMBERS: Member[] = [
  {
    id: "usr_1",
    name: "Ibukun Dairo",
    email: "ibukun@cuesoft.io",
    role: "owner",
    status: "active",
  },
  {
    id: "usr_2",
    name: "Sade Balogun",
    email: "sade@cuesoft.io",
    role: "admin",
    status: "invited",
  },
  {
    id: "usr_3",
    name: "Tunde Alao",
    email: "tunde@cuesoft.io",
    role: "member",
    status: "disabled",
  },
];

const CATALOG_ENTRY: ServiceCatalogEntry = {
  id: "svc_checkout",
  name: "checkout",
  owner: "Sade",
  links: {
    repo: "https://github.com/cuesoftinc/upstat",
    runbook: "https://cuesoft.gitbook.io/upstat",
  },
  environments: ["prod", "staging"],
  telemetry: { metrics: true, logs: true, traces: true, rum: false },
};

const ERROR_GROUPS: ErrorGroup[] = [
  {
    fingerprint: "fe4a9d21",
    message: "TypeError: Cannot read properties of undefined (reading 'total')",
    count: 128,
    first_seen: "2026-07-12T00:00:00Z",
    last_seen: "2026-07-18T11:42:00Z",
    state: "regressed",
    sparkline: [1, 4, 2, 8, 3, 9, 12],
  },
  {
    fingerprint: "0b7c3aa9",
    message: "ChunkLoadError: Loading chunk 42 failed",
    count: 61,
    first_seen: "2026-07-17T00:00:00Z",
    last_seen: "2026-07-18T10:02:00Z",
    state: "new",
    sparkline: [0, 0, 2, 5, 9, 14, 31],
  },
  {
    fingerprint: "91d2f004",
    message: "AbortError: The user aborted a request",
    count: 4407,
    first_seen: "2026-05-02T00:00:00Z",
    last_seen: "2026-07-18T11:59:00Z",
    state: "ongoing",
    sparkline: [40, 44, 39, 46, 41, 45, 43],
  },
];

function MonitorRowDemo({
  status,
  muted: initialMuted,
}: {
  status: StatusPillStatus;
  muted?: boolean;
}) {
  const [muted, setMuted] = useState(initialMuted ?? false);
  return (
    <MonitorRow
      status={status}
      name={`${status} monitor`}
      summary="GET https://upstat.cuesoft.io/health"
      lastTriggered={status === "crit" ? "12m ago" : undefined}
      muted={muted}
      onMutedChange={setMuted}
    />
  );
}

export function OperationsDemos() {
  return (
    <>
      <RowDemos />
      <CardDemos />
    </>
  );
}

function RowDemos() {
  return (
    <Section title="Rows — monitors, logs, members, keys, dashboards, catalog, errors">
      <Cell label="MonitorRow status ×6 · muted" grow>
        <div className="flex flex-col">
          {STATUSES.map((s) => (
            <MonitorRowDemo key={s} status={s} muted={s === "paused"} />
          ))}
        </div>
      </Cell>
      <Cell label="LogLine collapsed / expanded (MI-5 ⌘click pivot)" grow>
        <div className="flex flex-col gap-[var(--space-2)]">
          <LogLine
            event={{
              ...LOG_EVENT,
              id: "log_c",
              level: "INFO",
              message: "request served path=/v1/stats status=200",
            }}
            onPivot={() => undefined}
          />
          <LogLine
            event={LOG_EVENT}
            defaultExpanded
            onPivot={() => undefined}
          />
        </div>
      </Cell>
      <Cell label="MemberRow active / invited / disabled" grow>
        <div className="flex flex-col">
          {MEMBERS.map((m) => (
            <MemberRow key={m.id} member={m} onRoleChange={() => undefined} />
          ))}
        </div>
      </Cell>
      <Cell label="APIKeyRow active / rotation-grace / revoked" grow>
        <div className="flex flex-col">
          {API_KEYS.map((k) => (
            <APIKeyRow key={k.id} apiKey={k} onRevoke={() => undefined} />
          ))}
        </div>
      </Cell>
      <Cell label="DashboardListRow favorite / shared" grow>
        <div className="flex flex-col">
          <DashboardListRow
            name="Org overview"
            updated="2d ago"
            favorite
            shared
          />
          <DashboardListRow
            name="Checkout funnel"
            updated="4h ago"
            favorite={false}
          />
        </div>
      </Cell>
      <Cell label="ServiceCatalogRow presence dots ×4" grow>
        <ServiceCatalogRow entry={CATALOG_ENTRY} />
      </Cell>
      <Cell label="ErrorGroupRow new / ongoing / regressed" grow>
        <div className="flex flex-col">
          {ERROR_GROUPS.map((g) => (
            <ErrorGroupRow key={g.fingerprint} group={g} />
          ))}
        </div>
      </Cell>
      <Cell label="SettingsRow control slots · disabled" grow>
        <div className="flex flex-col">
          <SettingsRow
            label="Org name"
            description="Shown on the public status page."
            control={
              <Input
                defaultValue="Upstat"
                aria-label="Org name"
                className="w-48"
              />
            }
          />
          <SettingsRow
            label="Timezone"
            description="IANA — display bucketing only (X-10)."
            control={<SelectDemo typeahead />}
          />
          <SettingsRow label="Weekly digest" control={<SwitchDemo />} />
          <SettingsRow
            label="Retention override"
            description="Managed by plan."
            control={<SwitchDemo disabled />}
            disabled
          />
        </div>
      </Cell>
    </Section>
  );
}

function CardDemos() {
  return (
    <Section title="Cards — SLO, uptime, alerting, incidents">
      <Cell label="SLOCard healthy / burning / exhausted (MI-15)">
        <div className="flex flex-wrap gap-[var(--space-3)]">
          {SLOS.map((slo) => (
            <SLOCard key={slo.id} slo={slo} className="w-72" />
          ))}
        </div>
      </Cell>
      <Cell label="UptimeCard 90-day strip (outage + nodata gaps)" grow>
        <UptimeCard
          name="upstat.cuesoft.io"
          days={DAYS_90}
          uptimePct={99.87}
          p95Ms={96}
        />
      </Cell>
      <Cell label="AlertChannelCard webhook/email × health ×3">
        <div className="flex w-96 flex-col gap-[var(--space-2)]">
          {CHANNELS.map((ch) => (
            <AlertChannelCard
              key={ch.id}
              channel={ch}
              onVerify={() => undefined}
              onDelete={() => undefined}
            />
          ))}
        </div>
      </Cell>
      <Cell label="AlertRuleCard metric-threshold">
        <AlertRuleCard rule={RULE} className="w-96" />
      </Cell>
      <Cell label="IncidentBanner sev1 / sev2 / resolved" grow>
        <div className="flex flex-col gap-[var(--space-2)]">
          <IncidentBanner
            sev={1}
            title="Checkout 5xx spike"
            age="38m"
            responders={["Ibukun Dairo", "Sade Balogun"]}
          />
          <IncidentBanner
            sev={2}
            title="Ingest queue backlog"
            age="3h"
            responders={["Tunde Alao"]}
          />
          <IncidentBanner
            sev={2}
            title="status-page latency"
            age="4m"
            responders={["Sade Balogun"]}
            resolved
          />
        </div>
      </Cell>
      <Cell label="AlertFeedRow ×3 + NotificationPopover (MI-14)">
        <div className="flex flex-wrap gap-[var(--space-4)]">
          <div className="w-96 rounded-(--radius) border border-border">
            {ALERT_EVENTS.map((e) => (
              <AlertFeedRow key={e.id} event={e} />
            ))}
          </div>
          <NotificationPopover events={ALERT_EVENTS} />
          <NotificationPopover events={[]} />
        </div>
      </Cell>
      <Cell label="IncidentComposer (MI-10 slash commands)" grow>
        <IncidentComposer onSubmit={() => undefined} />
      </Cell>
      <Cell label="IncidentHistoryEntry phases" grow>
        <IncidentHistoryEntry
          title="INC-42 — Checkout 5xx spike"
          updates={[
            {
              ts: "2026-07-18T09:00:00Z",
              phase: "investigating",
              body: "Declared; paging checkout on-call.",
              author: "Ibukun",
            },
            {
              ts: "2026-07-18T09:20:00Z",
              phase: "identified",
              body: "ClickHouse merge storm on metrics_points.",
              author: "Sade",
            },
            {
              ts: "2026-07-18T09:45:00Z",
              phase: "monitoring",
              body: "Ingest throttle applied — error rate recovering.",
              author: "Sade",
            },
            {
              ts: "2026-07-18T10:10:00Z",
              phase: "resolved",
              body: "All clear; postmortem to follow.",
              author: "Ibukun",
            },
          ]}
        />
      </Cell>
    </Section>
  );
}
