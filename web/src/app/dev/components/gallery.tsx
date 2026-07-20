"use client";

/**
 * Dev-only component gallery — every W1 registry component in all variants,
 * dark (product default) first, then the same registry under the light
 * token mode. Unlinked route; exists for the Figma-match QA loop
 * (web-implementation.md §2 W1 "closes when" criteria).
 */

import { useState } from "react";
import type {
  AlertChannel,
  AlertEvent,
  AlertRule,
  ApiKey,
  ErrorGroup,
  LogEvent,
  Member,
  Series,
  ServiceCatalogEntry,
  Slo,
  Trace,
  UptimeDay,
} from "@/models";
import { Gauge, Table2 } from "lucide-react";

import { AlertChannelCard } from "@/components/ui/AlertChannelCard";
import {
  AlertFeedRow,
  NotificationPopover,
} from "@/components/ui/AlertFeedRow";
import { AlertRuleCard } from "@/components/ui/AlertRuleCard";
import { APIKeyRow } from "@/components/ui/APIKeyRow";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CloudVsSelfHostTable } from "@/components/ui/CloudVsSelfHostTable";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { BufferedCountChip, CountBadge } from "@/components/ui/CountBadge";
import { DashboardListRow } from "@/components/ui/DashboardListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorGroupRow } from "@/components/ui/ErrorGroupRow";
import { FacetGroup } from "@/components/ui/FacetGroup";
import { FAQItem } from "@/components/ui/FAQItem";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import { Heatmap } from "@/components/ui/Heatmap";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import { IncidentComposer } from "@/components/ui/IncidentComposer";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { Input } from "@/components/ui/Input";
import { KbdChip } from "@/components/ui/KbdChip";
import { LevelChip } from "@/components/ui/LevelChip";
import { LogHistogram } from "@/components/ui/LogHistogram";
import { LogLine } from "@/components/ui/LogLine";
import { MarketingFooter } from "@/components/ui/MarketingFooter";
import { MarketingNav } from "@/components/ui/MarketingNav";
import { MemberRow } from "@/components/ui/MemberRow";
import { Modal } from "@/components/ui/Modal";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { NavRail, NavRailItem } from "@/components/ui/NavRail";
import { MARKETING_PILLARS, PillarCard } from "@/components/ui/PillarCard";
import { QueryBar } from "@/components/ui/QueryBar";
import { QueryPill } from "@/components/ui/QueryPill";
import { QueryValue } from "@/components/ui/QueryValue";
import { SavedViewChip } from "@/components/ui/SavedViewChip";
import { Select } from "@/components/ui/Select";
import { ServiceCatalogRow } from "@/components/ui/ServiceCatalogRow";
import { ServiceMapNode } from "@/components/ui/ServiceMapNode";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { SevChip } from "@/components/ui/SevChip";
import { ShortcutCheatsheet } from "@/components/ui/ShortcutCheatsheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { SLOCard } from "@/components/ui/SLOCard";
import { SpanDrawer } from "@/components/ui/SpanDrawer";
import { SpanRow } from "@/components/ui/SpanRow";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { Table } from "@/components/ui/Table";
import { ThresholdOverlay } from "@/components/ui/ThresholdOverlay";
import { TimePicker, type TimePreset } from "@/components/ui/TimePicker";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { Toast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { TopBar } from "@/components/ui/TopBar";
import { TopList } from "@/components/ui/TopList";
import { TraceMinimap } from "@/components/ui/TraceMinimap";
import { TraceWaterfall } from "@/components/ui/TraceWaterfall";
import { UptimeCard } from "@/components/ui/UptimeCard";
import { WidgetShell } from "@/components/ui/WidgetShell";
import { WidgetTypeCell } from "@/components/ui/WidgetTypeCell";
import { WidgetTypePicker } from "@/components/ui/WidgetTypePicker";
import { ZoomStackChip } from "@/components/ui/ZoomStackChip";

/* ------------------------------------------------------------------ */
/* Deterministic demo data (mirrors the §6 seed narrative)             */
/* ------------------------------------------------------------------ */

const STATUSES: StatusPillStatus[] = [
  "ok",
  "warn",
  "crit",
  "nodata",
  "paused",
  "pending",
];

const SERIES: Series[] = [
  {
    name: "p95(http.request.duration_ms)",
    tags: { service: "checkout" },
    points: Array.from({ length: 24 }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 6, 18, i)).toISOString(),
      value: 140 + Math.round(60 * Math.sin(i / 3) + (i === 14 ? 220 : 0)),
    })),
  },
  {
    name: "p50(http.request.duration_ms)",
    tags: { service: "checkout" },
    points: Array.from({ length: 24 }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 6, 18, i)).toISOString(),
      value: 60 + Math.round(18 * Math.sin(i / 3)),
    })),
  },
];

const DAYS_90: UptimeDay[] = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 3, 20 + i)).toISOString().slice(0, 10),
  // an outage window around day 61 and nodata gaps early on
  uptime_pct: i === 61 ? 92.4 : i === 62 ? 98.1 : i < 4 ? null : 100,
  down_minutes: i === 61 ? 109 : i === 62 ? 27 : 0,
}));

const SPARKLINE = [142, 138, 151, 149, 164, 158, 171, 166, 149, 143, 140, 152];

const LOG_EVENT: LogEvent = {
  id: "log_1",
  ts: "2026-07-18T09:12:44.120Z",
  service: "clickhouse",
  level: "ERROR",
  host: "gcp-lagos-1",
  message: "insert failed table=metrics_points code=252 too many parts",
  attrs: { env: "prod", table: "metrics_points", code: 252, retriable: true },
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
};

const TRACE: Trace = {
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
  root_service: "ingest-gw",
  root_name: "POST /v1/events",
  start: "2026-07-18T09:12:44.000Z",
  duration_ms: 184,
  span_count: 6,
  status: "error",
  spans: [
    {
      trace_id: "t",
      span_id: "s1",
      parent_id: null,
      service: "ingest-gw",
      name: "POST /v1/events",
      start: "2026-07-18T09:12:44.000Z",
      duration_ns: 184_000_000,
      status: "error",
      attrs: { "http.status_code": "500" },
    },
    {
      trace_id: "t",
      span_id: "s2",
      parent_id: "s1",
      service: "ingest-gw",
      name: "auth.check",
      start: "2026-07-18T09:12:44.004Z",
      duration_ns: 9_000_000,
      status: "ok",
      attrs: {},
    },
    {
      trace_id: "t",
      span_id: "s3",
      parent_id: "s1",
      service: "worker",
      name: "batch.validate",
      start: "2026-07-18T09:12:44.016Z",
      duration_ns: 32_000_000,
      status: "ok",
      attrs: {},
    },
    {
      trace_id: "t",
      span_id: "s4",
      parent_id: "s3",
      service: "worker",
      name: "schema.map",
      start: "2026-07-18T09:12:44.020Z",
      duration_ns: 14_000_000,
      status: "ok",
      attrs: {},
    },
    {
      trace_id: "t",
      span_id: "s5",
      parent_id: "s1",
      service: "clickhouse",
      name: "INSERT metrics_points",
      start: "2026-07-18T09:12:44.060Z",
      duration_ns: 118_000_000,
      status: "error",
      attrs: { "db.system": "clickhouse" },
    },
    {
      trace_id: "t",
      span_id: "s6",
      parent_id: "s5",
      service: "clickhouse",
      name: "merge.parts",
      start: "2026-07-18T09:12:44.100Z",
      duration_ns: 41_000_000,
      status: "ok",
      attrs: {},
    },
  ],
};

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

const HISTOGRAM_BUCKETS = Array.from({ length: 16 }, (_, i) => ({
  ts: new Date(Date.UTC(2026, 6, 18, 9, i * 5)).toISOString(),
  counts: {
    TRACE: (i * 3) % 5,
    DEBUG: 4 + ((i * 7) % 9),
    INFO: 22 + ((i * 13) % 21),
    WARN: (i * 5) % 7,
    ERROR: i === 9 || i === 10 ? 14 : (i * 2) % 3,
  },
}));

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
].map((tz) => ({ value: tz, label: tz }));

const SELF_HOST_SNIPPET_TABS = [
  {
    label: "Docker Compose",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && docker compose up --build -d",
  },
  {
    label: "Helm",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && helm install upstat deploy/helm",
  },
];

const SNIPPET_TABS = [
  {
    label: "Go",
    code: `exporter, _ := otlptracehttp.New(ctx)\ntp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))\notel.SetTracerProvider(tp)`,
  },
  {
    label: "Python",
    code: `from opentelemetry import trace\nprovider = TracerProvider()\nprovider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))`,
  },
  {
    label: "Node",
    code: `import { NodeSDK } from "@opentelemetry/sdk-node";\nconst sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() });\nsdk.start();`,
  },
  {
    label: "k8s",
    code: `helm install upstat-agent upstat/agent \\\n  --set ingest.endpoint=https://ingest.upstat.cuesoft.io:4318`,
  },
];

/* ------------------------------------------------------------------ */
/* Gallery scaffolding                                                 */
/* ------------------------------------------------------------------ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[var(--space-3)]">
      <h2 className="border-b border-border pb-[var(--space-2)] text-[16px] font-semibold text-text">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-[var(--space-4)]">
        {children}
      </div>
    </section>
  );
}

function Cell({
  label,
  grow = false,
  children,
}: {
  label: string;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        grow
          ? "flex min-w-72 grow basis-[420px] flex-col gap-[var(--space-2)]"
          : "flex flex-col gap-[var(--space-2)]"
      }
    >
      <span className="font-data text-[11px] text-text-2">{label}</span>
      <div>{children}</div>
    </div>
  );
}

/* Stateful demos ---------------------------------------------------- */

function TimePickerDemo() {
  const [value, setValue] = useState<TimePreset | "custom">("1h");
  const [live, setLive] = useState(true);
  return (
    <TimePicker
      value={value}
      onChange={setValue}
      live={live}
      onLiveChange={setLive}
    />
  );
}

function QueryBarDemo({ syntaxError }: { syntaxError?: string }) {
  const [text, setText] = useState(syntaxError ? "serivce:web" : "");
  const [pills, setPills] = useState([
    { facet: "service", value: "checkout" },
    { facet: "status", value: "error", negated: true },
  ]);
  return (
    <QueryBar
      pills={pills}
      onRemovePill={(i) => setPills((p) => p.filter((_, j) => j !== i))}
      text={text}
      onTextChange={setText}
      suggestions={
        text
          ? [
              { text: "service:", cardinality: 7 },
              { text: "status:", cardinality: 4 },
            ]
          : []
      }
      syntaxError={syntaxError ?? null}
    />
  );
}

function FacetGroupDemo() {
  const [selected, setSelected] = useState<string[]>(["checkout"]);
  return (
    <FacetGroup
      name="service"
      values={[
        { value: "api-common", count: 4021 },
        { value: "checkout", count: 1210 },
        { value: "worker", count: 887 },
        { value: "ingest-gw", count: 640 },
        { value: "clickhouse", count: 212 },
      ]}
      selected={selected}
      onToggle={(v) =>
        setSelected((s) =>
          s.includes(v) ? s.filter((x) => x !== v) : [...s, v],
        )
      }
      topN={3}
    />
  );
}

function SelectDemo({
  typeahead,
  disabled,
}: {
  typeahead?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string | null>("Africa/Lagos");
  return (
    <Select
      options={TIMEZONES}
      value={value}
      onValueChange={setValue}
      typeahead={typeahead}
      disabled={disabled}
      aria-label="Org timezone"
      className="w-64"
    />
  );
}

function SwitchDemo({ disabled }: { disabled?: boolean }) {
  const [on, setOn] = useState(true);
  return (
    <Switch
      checked={on}
      onCheckedChange={setOn}
      disabled={disabled}
      aria-label="Demo switch"
    />
  );
}

function CheckboxDemo() {
  const [checked, setChecked] = useState<boolean | "indeterminate">(
    "indeterminate",
  );
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(next) => setChecked(next)}
      aria-label="Demo checkbox"
    />
  );
}

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

function FAQDemo() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqs = [
    {
      q: "Is everything open-source?",
      a: "Yes — the whole platform is MIT licensed; cloud runs the same code.",
    },
    {
      q: "Do you use cookies for analytics?",
      a: "No. RUM is cookieless by design — the event schema is the privacy boundary.",
    },
  ];
  return (
    <div className="flex w-full max-w-[720px] flex-col">
      {faqs.map((f, i) => (
        <FAQItem
          key={f.q}
          question={f.q}
          answer={f.a}
          expanded={openIndex === i}
          onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
        />
      ))}
    </div>
  );
}

function OverlaysDemo() {
  const [modal, setModal] = useState<"sm" | "lg" | "sheet" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-[var(--space-2)]">
      <Button kind="quiet" onClick={() => setModal("sm")}>
        Open modal (sm)
      </Button>
      <Button kind="quiet" onClick={() => setModal("lg")}>
        Open modal (lg)
      </Button>
      <Button kind="quiet" onClick={() => setModal("sheet")}>
        Open sheet
      </Button>
      <Button kind="quiet" onClick={() => setPaletteOpen(true)}>
        Command palette
      </Button>
      <Button kind="quiet" onClick={() => setCheatsheetOpen(true)}>
        Shortcut cheatsheet (?)
      </Button>
      {modal && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal === "sheet" ? "Monitor detail" : "Declare incident"}
          variant={modal}
          footer={
            <>
              <Button kind="quiet" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button kind="brand" onClick={() => setModal(null)}>
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-[1.45] text-text-2">
            Body slot — z layer sheet/modal 40, header + body + footer actions.
          </p>
        </Modal>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={[
          { id: "1", label: "Go to dashboards", kbd: "g d" },
          { id: "2", label: "Go to logs", kbd: "g l" },
          { id: "3", label: "Checkout health (dashboard)" },
        ]}
      />
      <ShortcutCheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
      />
    </div>
  );
}

function WidgetShellDemo() {
  const [mode, setMode] = useState<"view" | "edit" | "fullscreen">("view");
  return (
    <WidgetShell
      title="Checkout latency"
      query="service:checkout | p95()"
      mode={mode}
      onModeChange={setMode}
    >
      <TimeseriesPanel
        title=""
        series={SERIES}
        withLegend={false}
        height={120}
      />
    </WidgetShell>
  );
}

function SpanDrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button kind="quiet" onClick={() => setOpen(true)}>
        Open span drawer
      </Button>
      {open && (
        <SpanDrawer
          span={TRACE.spans[4]}
          logs={[LOG_EVENT]}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* The full registry, rendered once per theme ------------------------ */

function GalleryAll() {
  return (
    <div className="flex flex-col gap-[var(--space-8)] bg-bg p-[var(--space-6)] text-text">
      <Section title="Button · Input · GoogleAuthButton">
        <Cell label="Button kind × size × disabled">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Button kind="brand">Create monitor</Button>
            <Button kind="quiet">Cancel</Button>
            <Button kind="destructive">Delete</Button>
            <Button kind="brand" size="sm">
              Save
            </Button>
            <Button kind="quiet" size="sm">
              Duplicate
            </Button>
            <Button kind="brand" disabled>
              Disabled
            </Button>
          </div>
        </Cell>
        <Cell label="Input default / mono / error / disabled">
          <div className="flex w-72 flex-col gap-[var(--space-2)]">
            <Input placeholder="Monitor name" aria-label="Monitor name" />
            <Input
              mono
              defaultValue="service:checkout | p95()"
              aria-label="Query"
            />
            <Input
              error
              errorMessage="Must be a valid HTTPS URL"
              defaultValue="not-a-url"
              aria-label="Target"
            />
            <Input
              disabled
              placeholder="Disabled"
              aria-label="Disabled input"
            />
          </div>
        </Cell>
        <Cell label="GoogleAuthButton default / loading">
          <div className="flex w-72 flex-col gap-[var(--space-2)]">
            <GoogleAuthButton />
            <GoogleAuthButton loading />
          </div>
        </Cell>
      </Section>

      <Section title="Pills & chips">
        <Cell label="StatusPill ×6 + dot-only (crit breathes, MI-8)">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            {STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
            <StatusPill status="crit" dotOnly />
          </div>
        </Cell>
        <Cell label="QueryPill default / negated">
          <div className="flex gap-[var(--space-2)]">
            <QueryPill
              facet="service"
              value="api-common"
              onRemove={() => undefined}
            />
            <QueryPill
              facet="status"
              value="error"
              negated
              onRemove={() => undefined}
            />
          </div>
        </Cell>
        <Cell label="LevelChip ×5">
          <div className="flex gap-[var(--space-2)]">
            {(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const).map((l) => (
              <LevelChip key={l} level={l} />
            ))}
          </div>
        </Cell>
        <Cell label="SevChip ×3">
          <div className="flex gap-[var(--space-2)]">
            <SevChip sev={1} />
            <SevChip sev={2} />
            <SevChip sev={3} />
          </div>
        </Cell>
        <Cell label="CountBadge idle / pulse · BufferedCountChip (MI-4)">
          <div className="flex items-center gap-[var(--space-3)]">
            <CountBadge count={3} />
            <CountBadge count={128} pulse />
            <BufferedCountChip count={128} onClick={() => undefined} />
          </div>
        </Cell>
        <Cell label="KbdChip single / chord">
          <div className="flex items-center gap-[var(--space-3)]">
            <KbdChip keys="/" />
            <KbdChip keys="g d" />
            <KbdChip keys="⌘ k" />
          </div>
        </Cell>
        <Cell label="SavedViewChip personal / org-shared / active (MI-18)">
          <div className="flex gap-[var(--space-2)]">
            <SavedViewChip name="prod errors" />
            <SavedViewChip
              name="checkout p95"
              sharedWith={["Ibukun Dairo", "Sade Balogun"]}
            />
            <SavedViewChip name="ingest health" active />
          </div>
        </Cell>
        <Cell label="ZoomStackChip (MI-3)">
          <ZoomStackChip
            depth={2}
            label="09:12 – 09:40"
            onReset={() => undefined}
          />
        </Cell>
      </Section>

      <Section title="Toast · Tooltip · Avatar · Switch · Checkbox · Skeleton">
        <Cell label="Toast ×3">
          <div className="flex flex-col gap-[var(--space-2)]">
            <Toast
              kind="info"
              message="Dashboard exported as JSON."
              onDismiss={() => undefined}
            />
            <Toast
              kind="success"
              message="Monitor created."
              onDismiss={() => undefined}
            />
            <Toast
              kind="error"
              message="channel_unverified — verify the webhook first."
              onDismiss={() => undefined}
            />
          </div>
        </Cell>
        <Cell label="Tooltip text / multi-metric (hover)">
          <div className="flex gap-[var(--space-4)] pt-[var(--space-6)]">
            <Tooltip content="Copy query">
              <Button kind="quiet" size="sm">
                text
              </Button>
            </Tooltip>
            <Tooltip
              placement="bottom"
              content={[
                { label: "throughput", value: "1.2k req/s" },
                { label: "error", value: "0.42%" },
                { label: "latency", value: "142 ms" },
              ]}
            >
              <Button kind="quiet" size="sm">
                multi-metric
              </Button>
            </Tooltip>
          </div>
        </Cell>
        <Cell label="Avatar 20/24 · image · AvatarStack +n">
          <div className="flex items-center gap-[var(--space-3)]">
            <Avatar name="Ibukun Dairo" size={20} />
            <Avatar name="Sade Balogun" size={24} />
            <Avatar name="Repo Owner" size={24} src="/favicon.ico" />
            <AvatarStack
              names={[
                "Ibukun Dairo",
                "Sade Balogun",
                "Tunde Alao",
                "Chi Obi",
                "Ade King",
                "Zara Bello",
              ]}
            />
          </div>
        </Cell>
        <Cell label="Switch on/off/disabled">
          <div className="flex items-center gap-[var(--space-3)]">
            <SwitchDemo />
            <Switch
              checked={false}
              onCheckedChange={() => undefined}
              aria-label="Off switch"
            />
            <Switch checked disabled aria-label="Disabled switch" />
          </div>
        </Cell>
        <Cell label="Checkbox checked / indeterminate / disabled">
          <div className="flex items-center gap-[var(--space-3)]">
            <Checkbox
              checked
              onCheckedChange={() => undefined}
              aria-label="Checked"
            />
            <CheckboxDemo />
            <Checkbox checked={false} disabled aria-label="Disabled" />
          </div>
        </Cell>
        <Cell label="Skeleton line / value / panel-axis (static under reduced motion)">
          <div className="flex w-72 flex-col gap-[var(--space-2)]">
            <Skeleton kind="line" />
            <Skeleton kind="value" />
            <Skeleton kind="panel-axis" className="h-24" />
          </div>
        </Cell>
      </Section>

      <Section title="TimePicker · QueryBar · FacetGroup · Select">
        <Cell label="TimePicker presets + custom + live">
          <TimePickerDemo />
        </Cell>
        <Cell label="QueryBar pills + autocomplete" grow>
          <QueryBarDemo />
        </Cell>
        <Cell label="QueryBar syntax-error (MI-13)" grow>
          <QueryBarDemo syntaxError="unknown facet: serivce — did you mean service:?" />
        </Cell>
        <Cell label="FacetGroup top-N + counts (MI-6)">
          <div className="w-64">
            <FacetGroupDemo />
          </div>
        </Cell>
        <Cell label="Select / DropdownMenu · type-ahead (X-10) · disabled">
          <div className="flex flex-col gap-[var(--space-2)]">
            <SelectDemo />
            <SelectDemo typeahead />
            <SelectDemo disabled />
          </div>
        </Cell>
      </Section>

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

      <Section title="Charts — bespoke SVG (no chart libraries)">
        <Cell label="TimeseriesPanel line + legend + crosshair (MI-2)" grow>
          <TimeseriesPanel
            title="Checkout latency"
            query="service:checkout | p50(), p95()"
            series={SERIES}
          />
        </Cell>
        <Cell label="TimeseriesPanel area / bars" grow>
          <div className="flex flex-col gap-[var(--space-3)]">
            <TimeseriesPanel
              title="Requests"
              query="| rate()"
              series={[SERIES[1]]}
              mode="area"
              height={120}
            />
            <TimeseriesPanel
              title="Errors"
              query="status:error | count()"
              series={[SERIES[1]]}
              mode="bars"
              height={120}
              withLegend={false}
            />
          </div>
        </Cell>
        <Cell label="TimeseriesPanel loading / empty (MI-16 radar)" grow>
          <div className="flex flex-col gap-[var(--space-3)]">
            <TimeseriesPanel title="Loading" series={[]} loading height={120} />
            <TimeseriesPanel title="Empty" series={[]} height={120} />
          </div>
        </Cell>
        <Cell label="ThresholdOverlay over a panel (MI-9)" grow>
          <div className="relative">
            <TimeseriesPanel
              title="Test rule replay"
              query="| p95()"
              series={[SERIES[0]]}
              withLegend={false}
              height={140}
            />
            <ThresholdOverlay
              warnFrom={0.55}
              critFrom={0.8}
              markers={[0.58, 0.61]}
            />
          </div>
        </Cell>
        <Cell label="QueryValue tints + delta + sparkline">
          <div className="flex flex-wrap gap-[var(--space-3)]">
            <QueryValue
              value="142 ms"
              label="p95 latency"
              deltaPct={-4.2}
              threshold="ok"
            />
            <QueryValue
              value="1.24 s"
              label="p99 latency"
              deltaPct={12.8}
              threshold="warn"
            />
            <QueryValue
              value="4.7%"
              label="error rate"
              deltaPct={310}
              threshold="crit"
              sparkline={SPARKLINE}
            />
            <QueryValue
              value="18.4k"
              label="req/s"
              threshold="none"
              sparkline={SPARKLINE}
            />
          </div>
        </Cell>
        <Cell label="TopList ranked ×5 / loading">
          <div className="flex w-80 flex-col gap-[var(--space-3)]">
            <TopList
              entries={[
                { label: "/v1/events", value: 48210 },
                { label: "/v1/stats", value: 22110 },
                { label: "/v1/query", value: 9834 },
                { label: "/health", value: 5120 },
                { label: "/v1/monitors", value: 2210 },
              ]}
            />
            <TopList entries={[]} loading />
          </div>
        </Cell>
        <Cell label="Table numeric right-aligned mono">
          <Table
            className="w-[420px]"
            columns={[
              { key: "service", label: "service" },
              { key: "req_s", label: "req/s", numeric: true },
              { key: "p95", label: "p95", numeric: true },
              { key: "err", label: "error %", numeric: true },
            ]}
            rows={[
              { service: "api-common", req_s: 1204, p95: "182 ms", err: 0.4 },
              { service: "checkout", req_s: 311, p95: "412 ms", err: 4.7 },
              { service: "worker", req_s: 88, p95: "64 ms", err: null },
            ]}
          />
        </Cell>
        <Cell label="Heatmap intensity ramp (series/1)">
          <Heatmap
            columns={Array.from(
              { length: 12 },
              (_, i) => `${9 + Math.floor(i / 2)}:${i % 2 === 0 ? "00" : "30"}`,
            )}
            rows={["1s+", "500ms", "250ms", "100ms", "50ms"]}
            values={Array.from({ length: 5 }, (_, r) =>
              Array.from(
                { length: 12 },
                (_, c) => ((r * 7 + c * 13) % 19) + (c === 7 && r < 2 ? 30 : 0),
              ),
            )}
          />
        </Cell>
        <Cell label="LogHistogram level-stacked" grow>
          <LogHistogram buckets={HISTOGRAM_BUCKETS} />
        </Cell>
      </Section>

      <Section title="Traces & service map">
        <Cell label="SpanRow depth/status/hover (MI-7)" grow>
          <div className="flex flex-col">
            <SpanRow
              span={TRACE.spans[0]}
              depth={0}
              colorIndex={0}
              offsetFrac={0}
              widthFrac={1}
            />
            <SpanRow
              span={TRACE.spans[2]}
              depth={1}
              colorIndex={1}
              offsetFrac={0.08}
              widthFrac={0.18}
            />
            <SpanRow
              span={TRACE.spans[4]}
              depth={1}
              colorIndex={2}
              offsetFrac={0.33}
              widthFrac={0.64}
              selected
            />
          </div>
        </Cell>
        <Cell label="TraceWaterfall (click a span → drawer)" grow>
          <TraceWaterfall trace={TRACE} />
        </Cell>
        <Cell label="TraceMinimap default / service highlight">
          <div className="flex flex-col gap-[var(--space-2)]">
            <TraceMinimap
              spans={TRACE.spans}
              durationMs={TRACE.duration_ms}
              startTs={TRACE.start}
            />
            <TraceMinimap
              spans={TRACE.spans}
              durationMs={TRACE.duration_ms}
              startTs={TRACE.start}
              highlightService="clickhouse"
            />
          </div>
        </Cell>
        <Cell label="SpanDrawer tabs (tags / logs / process)">
          <SpanDrawerDemo />
        </Cell>
        <Cell label="ServiceMapNode healthy / erroring / selected">
          <div className="flex gap-[var(--space-4)]">
            <ServiceMapNode
              name="api-common"
              reqPerS={1204}
              errorRate={0.004}
              colorIndex={0}
            />
            <ServiceMapNode
              name="checkout"
              reqPerS={311}
              errorRate={0.11}
              colorIndex={1}
            />
            <ServiceMapNode
              name="worker"
              reqPerS={88}
              errorRate={0.01}
              colorIndex={2}
              selected
            />
          </div>
        </Cell>
      </Section>

      <Section title="Widgets & empty states">
        <Cell label="WidgetShell view / edit / fullscreen (MI-11/12)" grow>
          <WidgetShellDemo />
        </Cell>
        <Cell label="WidgetTypeCell default / selected">
          <div className="flex gap-[var(--space-2)]">
            <WidgetTypeCell icon={Table2} label="Table" />
            <WidgetTypeCell icon={Gauge} label="Query value" selected />
          </div>
        </Cell>
        <Cell label="WidgetTypePicker row strip" grow>
          <WidgetTypePicker layout="row" selected="timeseries" />
        </Cell>
        <Cell label="WidgetTypePicker grid (create flow)" grow>
          <WidgetTypePicker layout="grid" selected="heatmap" />
        </Cell>
        <Cell label="EmptyState per pillar (MI-16) + waiting radar" grow>
          <div className="flex flex-wrap gap-[var(--space-3)]">
            <EmptyState pillar="metrics" waiting />
            <EmptyState pillar="logs" />
            <EmptyState pillar="traces" />
            <EmptyState pillar="rum" />
            <EmptyState pillar="uptime" compact />
          </div>
        </Cell>
      </Section>

      <Section title="App chrome">
        <Cell label="NavRail (12 pillars) + flyout labels">
          <div className="h-[420px] overflow-hidden rounded-(--radius) border border-border">
            <NavRail activeKey="logs" />
          </div>
        </Cell>
        <Cell label="NavRailItem default / active">
          <div className="flex gap-[var(--space-2)]">
            <NavRailItem icon={Gauge} label="Metrics" />
            <NavRailItem icon={Gauge} label="Metrics" active />
          </div>
        </Cell>
        <Cell label="TopBar org · time · search (/) · bell (MI-14)" grow>
          <div className="flex flex-col gap-[var(--space-2)]">
            <TopBar
              orgName="Upstat"
              env="prod"
              timePicker={<TimePickerDemo />}
              unreadCount={3}
            />
            <TopBar orgName="Upstat" env="staging" unreadCount={0} />
          </div>
        </Cell>
        <Cell
          label="Overlays — Modal sm/lg · Sheet · CommandPalette · ShortcutCheatsheet"
          grow
        >
          <OverlaysDemo />
        </Cell>
      </Section>

      <Section title="Status page">
        <Cell label="StatusPageHeader ×4" grow>
          <div className="flex flex-col gap-[var(--space-2)]">
            <StatusPageHeader
              orgName="Upstat"
              overall="operational"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="degraded"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="partial_outage"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="major_outage"
              lastUpdated="2026-07-18T12:00:00Z"
            />
          </div>
        </Cell>
        <Cell label="StatusPageComponentRow (90-day strip)" grow>
          <div className="flex flex-col">
            <StatusPageComponentRow
              name="API"
              status="ok"
              days={DAYS_90}
              uptimePct={99.87}
            />
            <StatusPageComponentRow
              name="Ingest"
              status="crit"
              days={DAYS_90}
              uptimePct={98.02}
            />
            <StatusPageComponentRow
              name="Status page"
              status="nodata"
              days={DAYS_90}
              uptimePct={null}
            />
          </div>
        </Cell>
      </Section>

      <Section title="Marketing (Stage-5 kit)">
        <Cell
          label="MarketingNav (parity canon rev: 4 links · star badge · theme toggle · Sign in · Try Cloud)"
          grow
        >
          <div className="overflow-hidden rounded-(--radius) border border-border">
            <MarketingNav starCount={1284} />
          </div>
        </Cell>
        <Cell label="PillarCard ×8 (compact grid)" grow>
          <div className="grid max-w-[720px] grid-cols-2 gap-[var(--space-3)] md:grid-cols-4">
            {MARKETING_PILLARS.map((p) => (
              <PillarCard key={p.pillar} {...p} compact />
            ))}
          </div>
        </Cell>
        <Cell label="PillarCard full">
          <PillarCard {...MARKETING_PILLARS[4]} className="w-72" />
        </Cell>
        <Cell label="CodeSnippet + Tabs (Go/Python/Node/k8s, copy ✓)" grow>
          <CodeSnippet tabs={SNIPPET_TABS} className="max-w-[640px]" />
        </Cell>
        <Cell
          label="CodeSnippet + Tabs, prompt mode (A14: Docker Compose | Helm)"
          grow
        >
          <CodeSnippet
            tabs={SELF_HOST_SNIPPET_TABS}
            tabsLabel="Install method"
            prompt
            className="max-w-[640px]"
          />
        </Cell>
        <Cell label="CloudVsSelfHostTable (A9)" grow>
          <CloudVsSelfHostTable className="max-w-[640px]" />
        </Cell>
        <Cell label="FAQItem single-open accordion (A15)" grow>
          <FAQDemo />
        </Cell>
        <Cell label="MarketingFooter" grow>
          <div className="overflow-hidden rounded-(--radius) border border-border">
            <MarketingFooter />
          </div>
        </Cell>
      </Section>
    </div>
  );
}

export function ComponentGallery() {
  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg-elev px-[var(--space-6)] py-[var(--space-4)]">
        <h1 className="text-[20px] font-semibold">W1 component gallery</h1>
        <p className="text-[13px] leading-[1.45] text-text-2">
          Dev-only QA surface — every Figma registry component, all variants.
          Dark (product default) first; the identical registry renders under the
          light token mode below.
        </p>
      </header>

      {/* Semantic landmark: the gallery body is the page's single <main>
          (live-QA sweep: this page had zero). Component instances inside
          keep their own semantics — StatusPageHeader demos legitimately
          render <h1>, so this dev-only page has extra h1s by design. */}
      <main>
        <GalleryAll />

        <div data-theme="light">
          <div className="border-y border-border bg-bg-elev px-[var(--space-6)] py-[var(--space-3)]">
            <h2 className="text-[16px] font-semibold text-text">Light mode</h2>
          </div>
          <GalleryAll />
        </div>
      </main>
    </div>
  );
}
