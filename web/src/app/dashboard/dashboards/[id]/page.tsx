"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetShell, type WidgetShellMode } from "@/components/ui/WidgetShell";
import { WidgetTypePicker } from "@/components/ui/WidgetTypePicker";
import type { Widget, WidgetLayout, WidgetType } from "@/models";
import { useDashboardController } from "@/controllers/dashboards";
import { defaultWidget, substituteVars } from "@/controllers/widgets";
import { useTimeRange } from "@/controllers/time-range";
import { WidgetBody } from "./widget-body";

const ROW_H = 88;
const GUTTER = 8;
const COLS = 12;

interface DragState {
  widgetId: string;
  kind: "move" | "resize";
  startX: number;
  startY: number;
  origin: WidgetLayout;
  preview: WidgetLayout;
}

/**
 * B2 dashboard view — 12-col grid editor (Figma 126:510): MI-11 edit mode
 * (`e`, drag/resize, Saved pulse), MI-12 widget fullscreen, MI-2 synced
 * crosshair across widgets, MI-3 drag-zoom into the global range,
 * template-variable bar ($env/$service).
 */
export default function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const ctrl = useDashboardController(id, searchParams.get("edit") === "1");
  const time = useTimeRange();
  const dashboard = ctrl.data;

  // MI-2: one crosshair for every widget in view.
  const [cursor, setCursor] = useState<number | null>(null);
  // template variables ($env, $service) — pages.md B2
  const [vars, setVars] = useState<Record<string, string>>({});
  // MI-12 fullscreen
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  // widget editor modal (add or edit)
  const [editorTarget, setEditorTarget] = useState<Widget | "new" | null>(null);
  // MI-11 drag ghost
  const [drag, setDrag] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const effectiveVars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [name, values] of Object.entries(dashboard?.template_vars ?? {})) {
      out[name] = vars[name] ?? values[0] ?? "";
    }
    return out;
  }, [dashboard?.template_vars, vars]);

  const cellW = useCallback(() => {
    const width = gridRef.current?.clientWidth ?? 1200;
    return (width - GUTTER * (COLS - 1)) / COLS;
  }, []);

  const beginDrag = useCallback(
    (widget: Widget, kind: DragState["kind"]) => (e: React.PointerEvent) => {
      if (!ctrl.editMode) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({
        widgetId: widget.id,
        kind,
        startX: e.clientX,
        startY: e.clientY,
        origin: widget.layout,
        preview: widget.layout,
      });
    },
    [ctrl.editMode],
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const dCol = Math.round((e.clientX - drag.startX) / (cellW() + GUTTER));
      const dRow = Math.round((e.clientY - drag.startY) / (ROW_H + GUTTER));
      setDrag((d) => {
        if (!d) return d;
        const preview =
          d.kind === "move"
            ? {
                ...d.origin,
                x: Math.max(0, Math.min(COLS - d.origin.w, d.origin.x + dCol)),
                y: Math.max(0, d.origin.y + dRow),
              }
            : {
                ...d.origin,
                w: Math.max(2, Math.min(COLS - d.origin.x, d.origin.w + dCol)),
                h: Math.max(1, d.origin.h + dRow),
              };
        return { ...d, preview };
      });
    },
    [drag, cellW],
  );

  const onDragEnd = useCallback(() => {
    if (!drag) return;
    const { widgetId, preview, origin } = drag;
    setDrag(null);
    if (JSON.stringify(preview) !== JSON.stringify(origin)) {
      void ctrl.moveWidget(widgetId, preview);
    }
  }, [drag, ctrl]);

  if (ctrl.loading || !dashboard) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} kind="panel-axis" style={{ height: 220 }} />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...dashboard.widgets].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="dashboard-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="truncate text-[20px] font-semibold">{dashboard.name}</h1>
        <div className="flex items-center gap-2">
          {ctrl.savedPulse && (
            <span
              data-testid="saved-chip"
              className="rounded-(--radius) bg-ok/15 px-2 py-0.5 text-[12px] text-ok"
            >
              Saved
            </span>
          )}
          {ctrl.editMode && (
            <Button kind="quiet" onClick={() => setEditorTarget("new")} data-testid="add-widget">
              + Add widget
            </Button>
          )}
          <Button
            kind={ctrl.editMode ? "brand" : "quiet"}
            onClick={() => ctrl.setEditMode(!ctrl.editMode)}
            data-testid="edit-toggle"
          >
            {ctrl.editMode ? "Done" : "Edit (e)"}
          </Button>
        </div>
      </header>

      {/* template variable bar */}
      {Object.keys(dashboard.template_vars).length > 0 && (
        <section aria-label="Template variables" className="flex flex-wrap items-center gap-2">
          {Object.entries(dashboard.template_vars).map(([name, values]) => (
            <label key={name} className="flex items-center gap-1 text-[12px] text-text-2">
              <span className="font-data">${name} =</span>
              <Select
                options={values.map((v) => ({ value: v, label: v }))}
                value={effectiveVars[name] ?? null}
                onValueChange={(v) => setVars((prev) => ({ ...prev, [name]: v }))}
                aria-label={`$${name}`}
                className="min-w-28"
              />
            </label>
          ))}
        </section>
      )}

      {sorted.length === 0 ? (
        <section
          aria-label="Empty dashboard"
          className="rounded-(--radius) border border-dashed border-border p-10 text-center text-[13px] text-text-2"
        >
          No widgets yet — enter edit mode and add your first widget.
        </section>
      ) : (
        <div
          ref={gridRef}
          data-testid="widget-grid"
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridAutoRows: ROW_H,
            gap: GUTTER,
          }}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          {sorted.map((widget) => {
            const layout =
              drag?.widgetId === widget.id ? drag.preview : widget.layout;
            const mode: WidgetShellMode =
              fullscreenId === widget.id ? "fullscreen" : ctrl.editMode ? "edit" : "view";
            const plotH = layout.h * ROW_H + (layout.h - 1) * GUTTER - 72;
            return (
              <div
                key={widget.id}
                data-widget-id={widget.id}
                className="relative min-w-0"
                style={{
                  gridColumn: `${layout.x + 1} / span ${layout.w}`,
                  gridRow: `${layout.y + 1} / span ${layout.h}`,
                  opacity: drag?.widgetId === widget.id ? 0.85 : 1,
                }}
              >
                <WidgetShell
                  // titles resolve template vars like queries do ("Error
                  // rate — $service" reads as the picked service)
                  title={substituteVars(widget.title, effectiveVars)}
                  query={widget.query_string}
                  mode={mode}
                  onModeChange={(m) => setFullscreenId(m === "fullscreen" ? widget.id : null)}
                  onEdit={() => setEditorTarget(widget)}
                  onDuplicate={() => void ctrl.duplicateWidget(widget)}
                  onDelete={() => void ctrl.removeWidget(widget.id)}
                  className="h-full"
                >
                  <WidgetBody
                    widget={widget}
                    vars={effectiveVars}
                    cursor={cursor}
                    onCursorChange={setCursor}
                    onZoomRange={time.zoomBy}
                    onZoomReset={time.resetZoom}
                    height={mode === "fullscreen" ? 480 : Math.max(plotH, 64)}
                  />
                </WidgetShell>
                {ctrl.editMode && mode !== "fullscreen" && (
                  <>
                    {/* MI-11 drag strip — grabs the header band */}
                    <div
                      role="presentation"
                      aria-hidden="true"
                      data-testid={`drag-${widget.id}`}
                      onPointerDown={beginDrag(widget, "move")}
                      className="absolute inset-x-8 top-0 h-9 cursor-grab active:cursor-grabbing"
                    />
                    <button
                      type="button"
                      aria-label={`Resize ${widget.title}`}
                      onPointerDown={beginDrag(widget, "resize")}
                      className="absolute bottom-0 right-0 size-4 cursor-nwse-resize rounded-br-(--radius) border-b-2 border-r-2 border-brand/60"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <WidgetEditor
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
        onSave={async (input) => {
          if (editorTarget === "new") {
            await ctrl.addWidget(input);
          } else if (editorTarget) {
            await ctrl.updateWidget(editorTarget.id, input);
          }
          ctrl.pulseSaved();
          setEditorTarget(null);
        }}
      />
    </div>
  );
}

/** Add/edit widget modal — type picker row + title + query (§8.2 as-built). */
function WidgetEditor({
  target,
  onClose,
  onSave,
}: {
  target: Widget | "new" | null;
  onClose: () => void;
  onSave: (input: Omit<Widget, "id" | "dashboard_id">) => Promise<void>;
}) {
  const isNew = target === "new";
  const widget = isNew || !target ? null : target;
  const [type, setType] = useState<WidgetType | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // reset per-open — the React "derive state from props" pattern (render-
  // phase setState behind a change guard; no refs during render)
  const openKey = target === null ? "closed" : isNew ? "new" : (target as Widget).id;
  const [lastKey, setLastKey] = useState(openKey);
  if (lastKey !== openKey) {
    setLastKey(openKey);
    setType(null);
    setTitle(null);
    setQuery(null);
  }

  if (target === null) return null;

  const effType = type ?? widget?.type ?? "timeseries";
  const defaults = defaultWidget(effType);
  const effTitle = title ?? widget?.title ?? defaults.title;
  const effQuery = query ?? widget?.query_string ?? defaults.query_string ?? "";

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        type: effType,
        title: effTitle,
        query: null,
        query_string: effQuery,
        viz_options: widget?.viz_options ?? defaults.viz_options,
        layout: widget?.layout ?? defaults.layout,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add widget" : "Edit widget"}
      variant="lg"
      footer={
        <>
          <Button kind="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving} data-testid="save-widget">
            {saving ? "Saving…" : isNew ? "Add" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <WidgetTypePicker layout="row" selected={effType} onSelect={setType} />
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Title</span>
          <Input value={effTitle} onChange={(e) => setTitle(e.target.value)} data-testid="widget-title" />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Query</span>
          <Input
            mono
            value={effQuery}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="metric:http.request.duration_ms | p95() by service"
            data-testid="widget-query"
          />
        </label>
      </div>
    </Modal>
  );
}
