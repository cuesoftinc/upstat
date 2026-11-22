import { useState } from "react";
import type { Series, Trace } from "@/models";
import { Gauge, Table2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Heatmap } from "@/components/ui/Heatmap";
import { LogHistogram } from "@/components/ui/LogHistogram";
import { QueryValue } from "@/components/ui/QueryValue";
import { ServiceMapNode } from "@/components/ui/ServiceMapNode";
import { SpanDrawer } from "@/components/ui/SpanDrawer";
import { SpanRow } from "@/components/ui/SpanRow";
import { Table } from "@/components/ui/Table";
import { ThresholdOverlay } from "@/components/ui/ThresholdOverlay";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { TopList } from "@/components/ui/TopList";
import { TraceMinimap } from "@/components/ui/TraceMinimap";
import { TraceWaterfall } from "@/components/ui/TraceWaterfall";
import { WidgetShell } from "@/components/ui/WidgetShell";
import { WidgetTypeCell } from "@/components/ui/WidgetTypeCell";
import { WidgetTypePicker } from "@/components/ui/WidgetTypePicker";
import { Cell, Section } from "./gallery-layout";
import { LOG_EVENT } from "./gallery-fixtures";

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

const SPARKLINE = [142, 138, 151, 149, 164, 158, 171, 166, 149, 143, 140, 152];

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

export function TelemetryDemos() {
  return (
    <>
      <ChartDemos />
      <TraceDemos />
      <WidgetDemos />
    </>
  );
}

function ChartDemos() {
  return (
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
  );
}

function TraceDemos() {
  return (
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
  );
}

function WidgetDemos() {
  return (
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
  );
}
