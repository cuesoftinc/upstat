"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useState } from "react";
import type { LogEvent, Span } from "@/models";
import { LogLine } from "./LogLine";

export type SpanDrawerTab = "tags" | "logs" | "process";

export interface SpanDrawerProps {
  span: Span;
  /** Logs correlated to the span (logs-in-span tab). */
  logs?: LogEvent[];
  onClose: () => void;
  className?: string;
}

/** SpanDrawer — §8.2: right drawer with tabs tags / logs-in-span / process. */
export function SpanDrawer({ span, logs = [], onClose, className }: SpanDrawerProps) {
  const [tab, setTab] = useState<SpanDrawerTab>("tags");

  return (
    <aside
      aria-label={`Span ${span.name}`}
      className={clsx(
        "font-ui flex flex-col border-l border-border bg-bg-elev",
        // §2 detail drawer (480px right panel) on lg+; below lg it becomes a
        // full-width fixed sheet so the waterfall never side-scrolls the page
        "fixed inset-y-0 right-0 z-[var(--z-modal)] w-full max-w-[480px] shadow-xl",
        "lg:static lg:inset-auto lg:z-auto lg:h-full lg:w-[480px] lg:shadow-none",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold text-text">{span.name}</h3>
          <p className="font-data truncate text-[11px] text-text-2">
            {span.service} · {(span.duration_ns / 1e6).toFixed(1)} ms · {span.status}
          </p>
        </div>
        <button type="button" aria-label="Close span drawer" onClick={onClose} className="text-text-2 hover:text-text">
          <X className="size-4" />
        </button>
      </header>

      <nav role="tablist" aria-label="Span detail" className="flex border-b border-border px-2">
        {(["tags", "logs", "process"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-3 py-2 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
              tab === t
                ? "border-b-2 border-brand text-text"
                : "text-text-2 hover:text-text",
            )}
          >
            {t === "logs" ? `logs (${logs.length})` : t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "tags" && (
          <dl className="flex flex-col gap-1">
            {Object.entries(span.attrs).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12px]">
                <dt className="w-40 shrink-0 text-text-2">{k}</dt>
                <dd className="font-data min-w-0 break-all text-text">{v}</dd>
              </div>
            ))}
            {Object.keys(span.attrs).length === 0 && (
              <p className="text-[12px] text-text-2">No tags on this span.</p>
            )}
          </dl>
        )}
        {tab === "logs" &&
          (logs.length > 0 ? (
            <div className="rounded-(--radius) border border-border">
              {logs.map((log) => (
                <LogLine key={log.id} event={log} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-text-2">No logs within this span.</p>
          ))}
        {tab === "process" && (
          <dl className="flex flex-col gap-1 text-[12px]">
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-text-2">service</dt>
              <dd className="font-data text-text">{span.service}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-text-2">span_id</dt>
              <dd className="font-data text-text">{span.span_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-text-2">trace_id</dt>
              <dd className="font-data break-all text-text">{span.trace_id}</dd>
            </div>
          </dl>
        )}
      </div>
    </aside>
  );
}
