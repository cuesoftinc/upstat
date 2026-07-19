"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FacetGroup } from "@/components/ui/FacetGroup";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { QueryBar } from "@/components/ui/QueryBar";
import { SavedViewChip } from "@/components/ui/SavedViewChip";
import { Select } from "@/components/ui/Select";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { useMetricsExplorerController } from "@/controllers/explorer";
import { useMetricsController, useServicesController } from "@/controllers/telemetry";
import { useDashboardsController } from "@/controllers/dashboards";
import { PageTabs } from "../page-tabs";

/**
 * B3 metrics explorer (Figma 127:1011) — QueryBar (pills + autocomplete,
 * MI-13) over the seeded series, FacetSidebar (MI-6), synced crosshair
 * (MI-2), drag-zoom into the global range (MI-3), save-to-dashboard and
 * saved views (MI-18).
 */
export default function MetricsExplorerPage() {
  const ctrl = useMetricsExplorerController();
  const { summary } = useMetricsController();
  const services = useServicesController();
  const dashboards = useDashboardsController();
  const [cursor, setCursor] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDashboard, setSaveDashboard] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewOpen, setViewOpen] = useState(false);

  const ts = ctrl.result?.kind === "timeseries" ? ctrl.result : null;

  // MI-13: suggestions ranked by cardinality (metric names + facets).
  const suggestions = useMemo(() => {
    const metricSuggestions = (summary.data ?? []).map((m) => ({
      text: `metric:${m.name}`,
      cardinality: m.cardinality,
    }));
    const serviceSuggestions = (services.data ?? []).map((s) => ({
      text: `service:${s.service}`,
      cardinality: Math.round(s.req_per_s * 60),
    }));
    // full ranked list — QueryBar filters to the typed token and caps the
    // display; pre-slicing here hid every match outside the global top-8
    // (typing "metric:http.err" surfaced nothing — QA 2026-07-19)
    return [...metricSuggestions, ...serviceSuggestions].sort(
      (a, b) => (b.cardinality ?? 0) - (a.cardinality ?? 0),
    );
  }, [summary.data, services.data]);

  // ranked by count (MI-13's cardinality discipline applies to facets too)
  const serviceFacets = (services.data ?? [])
    .map((s) => ({
      value: s.service,
      count: Math.round(s.req_per_s * 60),
    }))
    .sort((a, b) => b.count - a.count);
  const selectedServices = ctrl.queryState.pills
    .filter((p) => p.facet === "service")
    .map((p) => p.value);

  const metricName =
    ctrl.queryState.pills.find((p) => p.facet === "metric")?.value ?? "http.requests_total";

  return (
    <div className="flex min-h-full flex-col gap-4 px-6 py-5" data-testid="metrics-explorer">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-[20px] font-semibold">Metrics</h1>
        <PageTabs
          label="Metrics views"
          tabs={[
            { label: "Explorer", href: "/dashboard/metrics", active: true },
            { label: "Summary", href: "/dashboard/metrics/summary" },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button kind="quiet" onClick={() => setViewOpen(true)} data-testid="save-view">
            Save view
          </Button>
          <Button kind="quiet" onClick={() => setSaveOpen(true)} data-testid="save-to-dashboard">
            Save to dashboard
          </Button>
        </div>
      </header>

      {/* saved views morph the QueryBar into named chips (MI-18) */}
      {(ctrl.views.data ?? []).length > 0 && (
        <ul aria-label="Saved views" className="flex flex-wrap items-center gap-2">
          {(ctrl.views.data ?? []).map((view) => (
            <li key={view.id}>
              <SavedViewChip
                name={view.name}
                sharedWith={view.scope === "org" ? view.shared_with : undefined}
                active={ctrl.activeQuery === view.query}
                onClick={() => ctrl.applyView(view)}
              />
            </li>
          ))}
        </ul>
      )}

      <QueryBar
        pills={ctrl.queryState.pills}
        onRemovePill={(i) => {
          ctrl.queryState.removePill(i);
          ctrl.submit();
        }}
        text={ctrl.queryState.text}
        onTextChange={ctrl.queryState.setText}
        onSubmit={ctrl.submit}
        suggestions={suggestions}
        onPickSuggestion={(s) => {
          const idx = s.text.indexOf(":");
          if (idx > 0) ctrl.pivot(s.text.slice(0, idx), s.text.slice(idx + 1));
        }}
        syntaxError={ctrl.syntaxError}
        placeholder="metric:… facet:value | fn() by facet"
      />

      {/* facets stack above the chart below lg (390 support) */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
        {/* FacetSidebar (MI-6) */}
        <aside aria-label="Facets" className="w-full shrink-0 lg:w-52">
          <FacetGroup
            name="service"
            values={serviceFacets}
            selected={selectedServices}
            onToggle={(value) => ctrl.pivot("service", value)}
            topN={8}
          />
          <FacetGroup
            name="env"
            values={[
              { value: "prod", count: 12400 },
              { value: "staging", count: 1900 },
            ]}
            selected={ctrl.queryState.pills.filter((p) => p.facet === "env").map((p) => p.value)}
            onToggle={(value) => ctrl.pivot("env", value)}
            defaultExpanded={false}
          />
        </aside>

        <section aria-label="Query result" className="min-w-0 flex-1">
          <TimeseriesPanel
            title={ctrl.queryState.text.includes("p95") ? `p95 latency — ${metricName}` : metricName}
            query={ctrl.activeQuery}
            series={ts?.series ?? []}
            loading={ctrl.running}
            height={320}
            cursor={cursor}
            onCursorChange={setCursor}
            onZoomRange={ctrl.time.zoomBy}
            onZoomReset={ctrl.time.resetZoom}
          />
          <p className="mt-2 text-[12px] text-text-2">
            metric: {metricName} · rollup {ts?.step ?? "auto"}
          </p>
        </section>
      </div>

      {/* B3 save-to-dashboard */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save to dashboard"
        footer={
          <>
            <Button kind="quiet" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!saveDashboard || !saveTitle.trim()}
              onClick={async () => {
                if (!saveDashboard) return;
                await ctrl.saveToDashboard(saveDashboard, saveTitle.trim());
                setSaveOpen(false);
              }}
              data-testid="confirm-save-to-dashboard"
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Dashboard</span>
            <Select
              options={(dashboards.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              value={saveDashboard}
              onValueChange={setSaveDashboard}
              placeholder="Choose a dashboard"
              aria-label="Dashboard"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Widget title</span>
            <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
          </label>
        </div>
      </Modal>

      {/* MI-18 save view */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Save view"
        variant="sm"
        footer={
          <>
            <Button kind="quiet" onClick={() => setViewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!viewName.trim() || ctrl.views.saving}
              onClick={async () => {
                await ctrl.views.save(viewName.trim(), ctrl.queryState.query);
                setViewName("");
                setViewOpen(false);
              }}
              data-testid="confirm-save-view"
            >
              Save view
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Name</span>
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Checkout latency"
            data-testid="view-name"
          />
        </label>
      </Modal>
    </div>
  );
}
