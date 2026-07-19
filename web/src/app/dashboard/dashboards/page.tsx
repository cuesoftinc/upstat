"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DashboardListRow } from "@/components/ui/DashboardListRow";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTypePicker } from "@/components/ui/WidgetTypePicker";
import type { WidgetType } from "@/models";
import { ageLabel } from "@/controllers/shell";
import { useDashboardsController } from "@/controllers/dashboards";
import { defaultWidget } from "@/controllers/widgets";

/**
 * B2 dashboards list (Figma 126:323) + create flow (172:9668): name →
 * widget-picker overlay → lands in MI-11 edit mode on the new dashboard.
 */
export default function DashboardsPage() {
  const router = useRouter();
  const { data, loading, create, toggleFavorite, importJson } = useDashboardsController();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WidgetType | null>("timeseries");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // B2 portable JSON import (api.md §6)
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const submitImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const dashboard = await importJson(importText);
      router.push(`/dashboard/dashboards/${dashboard.id}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "could not import the dashboard");
      setImporting(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const dashboard = await create(name.trim(), type ? defaultWidget(type) : undefined);
      router.push(`/dashboard/dashboards/${dashboard.id}?edit=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not create the dashboard");
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-5" data-testid="dashboards-list">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[20px] font-semibold">Dashboards</h1>
        <div className="flex items-center gap-2">
          <Button kind="quiet" onClick={() => setImportOpen(true)} data-testid="import-dashboard">
            Import JSON
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="new-dashboard">
            New dashboard
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} kind="line" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <section
          aria-label="No dashboards"
          className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] leading-[1.45] text-text-2"
        >
          No dashboards yet. Create one — it lands in edit mode with your
          first widget placed.
        </section>
      ) : (
        <ul aria-label="Dashboards">
          {(data ?? []).map((d) => (
            <li key={d.id}>
              <DashboardListRow
                name={d.name}
                meta={`${d.widgets.length} widget${d.widgets.length === 1 ? "" : "s"}`}
                updated={`updated ${ageLabel(d.updated_at)} ago`}
                favorite={d.favorite}
                shared={d.shared}
                onFavoriteChange={(favorite) => void toggleFavorite(d.id, favorite)}
                onClick={() => router.push(`/dashboard/dashboards/${d.id}`)}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create dashboard"
        variant="lg"
        footer={
          <>
            <Button kind="quiet" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={creating || name.trim().length === 0}
              data-testid="create-dashboard"
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="checkout — golden signals"
              data-testid="dashboard-name"
            />
          </label>

          <fieldset className="flex flex-col items-center gap-3 border-0 p-0">
            <legend className="mx-auto mb-2 text-center text-[14px] font-medium text-text">
              Choose a visualization
            </legend>
            <WidgetTypePicker layout="grid" selected={type} onSelect={setType} />
          </fieldset>

          {error && (
            <p role="alert" className="text-[13px] text-crit">
              {error}
            </p>
          )}
        </div>
      </Modal>

      {/* B2 portable JSON import (api.md §6) */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import dashboard JSON"
        variant="lg"
        footer={
          <>
            <Button kind="quiet" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitImport()}
              disabled={importing || importText.trim() === ""}
              data-testid="confirm-import"
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">
              Paste a portable dashboard definition (the Export JSON output)
            </span>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder='{"version": 1, "name": "…", "widgets": […]}'
              data-testid="import-json"
              className="font-data w-full resize-y rounded-(--radius) border border-border bg-bg px-2.5 py-2 text-[12px] leading-[1.45] text-text placeholder:text-text-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </label>
          <p role="alert" className="text-[13px] text-crit">
            {importError}
          </p>
        </div>
      </Modal>
    </div>
  );
}
