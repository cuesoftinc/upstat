/**
 * Home (Part A) copy — mirrors the Figma landing v2 frame 135:2 verbatim.
 * Accuracy rules (pages.md A13/§8.2b): stack line as ratified, MIT copy,
 * no invented stats/SLA/pricing.
 */

import type { CodeSnippetTab } from "@/components/ui/CodeSnippet";
import type { PlanFeatureRow } from "@/components/ui/CloudVsSelfHostTable";

/** A5 — OTel section snippet (Figma 135:281; endpoint copy from the frame). */
export const OTEL_SNIPPETS: CodeSnippetTab[] = [
  {
    label: "Go",
    code: `import "go.opentelemetry.io/otel"

exporter, _ := otlptracehttp.New(ctx,
  otlptracehttp.WithEndpoint(
    "ingest.upstat.cuesoft.io"))`,
  },
  {
    label: "Python",
    code: `from opentelemetry.exporter.otlp.proto.http.trace_exporter \\
    import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="https://ingest.upstat.cuesoft.io/v1/traces")`,
  },
  {
    label: "Node",
    code: `import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const exporter = new OTLPTraceExporter({
  url: "https://ingest.upstat.cuesoft.io/v1/traces",
});`,
  },
  {
    label: "k8s",
    code: `exporters:
  otlphttp:
    endpoint: https://ingest.upstat.cuesoft.io
service:
  pipelines:
    traces: { exporters: [otlphttp] }`,
  },
];

/** A15 — FAQ (first answer verbatim from the frame; rest per docs, no invented figures). */
export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Does it work with my existing OpenTelemetry setup?",
    answer:
      "Yes. Point any OTLP exporter at ingest.upstat.cuesoft.io — gRPC 4317 or HTTP 4318. If it speaks OTel today, it works; nothing proprietary goes in your code.",
  },
  {
    question: "What are the retention defaults?",
    answer:
      "Retention is configurable per signal — logs, metrics, traces and RUM each get their own window in Settings → Retention. Self-host defaults are yours to change; cloud limits will be published at GA.",
  },
  {
    question: "How is analytics cookieless — and what about GDPR?",
    answer:
      "No cookies and no raw IPs are stored: visitors are counted with a daily-rotating salted hash, so there is nothing to consent-banner. Sessions, web vitals and JS errors all work without tracking identity.",
  },
  {
    question: "Will it scale? What does ClickHouse mean for me?",
    answer:
      "Telemetry lands in ClickHouse — a columnstore built for exactly this shape of data. Ingest scales horizontally through the OTLP gateway, and queries stay fast at high cardinality.",
  },
  {
    question: "What's the license?",
    answer:
      "MIT. The whole platform — every pillar, no open-core split. Cloud runs the same code you can self-host.",
  },
];

/** A9 — plan rows (Figma 135:688 instance overrides). */
export const PLAN_ROWS: PlanFeatureRow[] = [
  { feature: "Managed OTLP ingestion", cloud: true, selfHost: false },
  { feature: "OTLP + StatsD endpoints", cloud: true, selfHost: true },
  { feature: "SSO / SAML", cloud: true, selfHost: false },
  { feature: "Own your data (compose)", cloud: false, selfHost: true },
  { feature: "Managed upgrades & backups", cloud: true, selfHost: false },
  { feature: "Community support", cloud: true, selfHost: true },
];

/** A13 — the ratified stack line (verbatim; 2026-07-18 QA loop). */
export const STACK_LINE =
  "Go gRPC services · Next.js + React/TS · ClickHouse · OpenTelemetry";

export const PROBLEM_CHIPS = [
  "Columnar telemetry store",
  "Query grammar & AST",
  "Alert evaluation engine",
  "Trace sampling strategies",
];

export const GOOD_FIRST_ISSUES = [
  "#412  logs: brush-zoom on the histogram header",
  "#397  slo: burn-rate sparkline in SLOCard",
  "#385  otlp: gzip support on HTTP 4318 intake",
];

export const SELF_HOST_CHECKLIST = [
  "Every pillar ships: uptime, RUM, metrics, logs, traces, dashboards, alerts, SLOs, status pages",
  "ClickHouse for telemetry, Postgres for the control plane — batteries included",
  "Helm chart for Kubernetes when you outgrow compose",
];

/** A14 — the mirrored two-line self-host snippets (tabbed CodeSnippet,
 *  Figma 413:2). Line 1 shared; line 2 is `make up` (compose) or the real
 *  chart at deploy/helm. */
export const SELF_HOST_SNIPPET_TABS: CodeSnippetTab[] = [
  {
    label: "Docker Compose",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && docker compose up --build -d",
  },
  {
    label: "Helm",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && helm install upstat deploy/helm",
  },
];

/** A14 — shared muted caption under the snippet, visible in both tab
 *  states (user-approved copy). */
export const SELF_HOST_CAPTION =
  "Compose ships MongoDB; the Helm chart expects yours (MONGO_URI). All 8 pillars come up on :3000.";

export const ARCHITECTURE_FLOW = [
  "OTel SDK / collector",
  "ingest-gw :4317/:4318",
  "ClickHouse + Postgres",
  "web (Next.js)",
];

export const GITHUB_URL = "https://github.com/cuesoftinc/upstat";
// canonical invite (SKILL.md parity canon 2026-07-19, verified live)
export const DISCORD_URL = "https://discord.gg/CDfZxxrxbb";
// real GitBook destinations (docs.upstat.cuesoft.io was NXDOMAIN —
// user-reported dead link 2026-07-19; canon hrefs, verified 200)
export const DOCS_URL = "https://cuesoft.gitbook.io/upstat";
export const SELF_HOST_DOCS_URL =
  "https://cuesoft.gitbook.io/upstat/system/deployment";
// CTA-dedupe destinations (canon "Community CTA placement", 2026-07-19):
// GitHub/Discord conversion moments live in exactly three spots — the
// extra sections carry differentiated real links instead.
export const QUERY_GRAMMAR_DOCS_URL =
  "https://cuesoft.gitbook.io/upstat/system/query-grammar";
export const ROADMAP_URL = "https://cuesoft.gitbook.io/upstat/product/roadmap";
export const CUELABS_URL = "https://cuelabs.cuesoft.io";

// A10 footer columns/copyright: superseded by the canonical parity footer
// (SKILL.md 2026-07-19) — MarketingFooter now owns the column set + legal bar.
