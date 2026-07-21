"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPageBuilderRow } from "@/components/ui/StatusPageBuilderRow";
import type { StatusPageConfig } from "@/models";
import { useMonitorsController } from "@/controllers/monitors";
import { useStatusPageBuilderController } from "@/controllers/status";
import { nextComponentId } from "./ids";

/**
 * B7 status-page builder (Figma "B7 — Status page builder", 331:12857) —
 * branding rows (page name · slug), StatusPageBuilderRow component list
 * (add / rename / reorder / monitor mapping / delete; row order = public
 * page order) and the public-URL preview. The public page it produces is
 * the existing /status/{slug} construction.
 */
export default function StatusPageBuilderPage() {
  const { config, save } = useStatusPageBuilderController();
  const monitors = useMonitorsController();
  const [draft, setDraft] = useState<StatusPageConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (config.loading || monitors.loading || !config.data) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 320 }} />
      </div>
    );
  }

  const current = draft ?? config.data;
  const dirty = draft !== null;

  const monitorOptions = (monitors.data ?? []).map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const mutate = (next: StatusPageConfig) => setDraft(next);

  const persist = async () => {
    setError(null);
    try {
      await save(current);
      setDraft(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save the page");
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= current.components.length) return;
    const components = [...current.components];
    [components[index], components[to]] = [components[to], components[index]];
    mutate({ ...current, components });
  };

  return (
    <div
      className="flex max-w-[760px] flex-col gap-6 px-6 py-5"
      data-testid="status-page-builder"
    >
      <header className="flex items-center gap-3">
        <h1 className="text-[20px] font-semibold">Status page — builder</h1>
        {saved && (
          <span className="rounded-(--radius) bg-ok/15 px-2 py-0.5 text-[12px] text-ok-text">
            Saved
          </span>
        )}
        <Button
          className="ml-auto"
          onClick={() => void persist()}
          disabled={!dirty}
          data-testid="save-status-page"
        >
          Save changes
        </Button>
      </header>

      <section aria-labelledby="branding-heading" className="flex flex-col">
        <h2 id="branding-heading" className="text-[16px] font-semibold">
          Branding
        </h2>
        <SettingsRow
          label="Page name"
          description="Shown in the public page header"
          control={
            <Input
              value={current.name}
              onChange={(e) => mutate({ ...current, name: e.target.value })}
              aria-label="Page name"
              className="w-56"
              data-testid="status-page-name"
            />
          }
        />
        <SettingsRow
          label="Slug"
          description="public at /status/{slug}"
          control={
            <Input
              mono
              value={current.slug}
              onChange={(e) => mutate({ ...current, slug: e.target.value })}
              aria-label="Slug"
              className="w-56"
              data-testid="status-page-slug"
            />
          }
        />
      </section>

      <section
        aria-labelledby="components-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="components-heading" className="text-[16px] font-semibold">
          Components
        </h2>
        {current.components.length === 0 ? (
          <p className="text-[13px] text-text-2">
            No components yet — each row publishes one uptime check.
          </p>
        ) : (
          <ol
            aria-label="Status page components"
            className="flex flex-col gap-2"
          >
            {current.components.map((row, i) => (
              <li key={row.id}>
                <StatusPageBuilderRow
                  name={row.name}
                  onRename={(name) =>
                    mutate({
                      ...current,
                      components: current.components.map((c, j) =>
                        j === i ? { ...c, name } : c,
                      ),
                    })
                  }
                  monitorId={row.monitor_id}
                  monitorOptions={monitorOptions}
                  onMonitorChange={(monitorId) =>
                    mutate({
                      ...current,
                      components: current.components.map((c, j) =>
                        j === i ? { ...c, monitor_id: monitorId } : c,
                      ),
                    })
                  }
                  onDelete={() =>
                    mutate({
                      ...current,
                      components: current.components.filter((_, j) => j !== i),
                    })
                  }
                  onMove={(delta) => move(i, delta)}
                />
              </li>
            ))}
          </ol>
        )}
        <div>
          <Button
            kind="quiet"
            size="sm"
            onClick={() =>
              mutate({
                ...current,
                components: [
                  ...current.components,
                  {
                    id: nextComponentId(),
                    name: "New component",
                    monitor_id: null,
                  },
                ],
              })
            }
            data-testid="add-component"
          >
            + Add component
          </Button>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-[13px] text-crit">
          {error}
        </p>
      )}

      <section
        aria-label="Public URL"
        className="flex flex-wrap items-center gap-3 rounded-(--radius) border border-border bg-bg-elev px-4 py-3"
      >
        <span className="text-[12px] text-text-2">Public URL</span>
        <code className="font-data text-[13px] text-text">
          upstat.cuesoft.io/status/{config.data.slug || "…"}
        </code>
        {config.data.slug && (
          <Link
            href={`/status/${config.data.slug}`}
            target="_blank"
            className="ml-auto rounded-(--radius) border border-border px-3 py-1.5 text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg"
            data-testid="open-public-page"
          >
            Open public page →
          </Link>
        )}
      </section>
      <p className="text-[12px] text-text-2">
        Saved changes publish immediately — component order and names render on
        the public page as listed here.
      </p>
    </div>
  );
}
