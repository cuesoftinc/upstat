"use client";

import { clsx } from "clsx";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

export type EmptyStatePillar = "metrics" | "logs" | "traces" | "rum" | "uptime";

const SNIPPETS: Record<EmptyStatePillar, string> = {
  metrics:
    "export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.upstat.cuesoft.io:4318",
  logs: "export OTEL_LOGS_EXPORTER=otlp OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.upstat.cuesoft.io:4318",
  traces:
    "export OTEL_TRACES_EXPORTER=otlp OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.upstat.cuesoft.io:4318",
  rum: '<script defer src="https://upstat.cuesoft.io/upstat.js" data-property="pk_live_…"></script>',
  uptime: "Create your first check — Monitors → New monitor",
};

export interface EmptyStateProps {
  pillar: EmptyStatePillar;
  /** Docs deep link. */
  docsHref?: string;
  /** Stops the sweep with a satisfying ping when data arrives (MI-16). */
  waiting?: boolean;
  /** Compact variant for in-panel empty states. */
  compact?: boolean;
  className?: string;
}

/**
 * EmptyState — MI-16 three-step inline setup: install snippet (copy ✓),
 * “waiting for data…” radar sweep, docs link. Sweep pauses under
 * prefers-reduced-motion (§5).
 */
export function EmptyState({
  pillar,
  docsHref = "https://cuesoft.gitbook.io/upstat",
  waiting = true,
  compact = false,
  className,
}: EmptyStateProps) {
  const [copied, setCopied] = useState(false);
  const snippet = SNIPPETS[pillar];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // non-secure context
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      data-pillar={pillar}
      className={clsx(
        "font-ui flex flex-col items-center gap-3 rounded-(--radius) border border-border bg-bg-elev p-6 text-center",
        compact && "gap-2 p-3",
        className,
      )}
    >
      {/* radar sweep */}
      <span
        aria-hidden="true"
        className={clsx(
          "relative inline-block rounded-full border border-border",
          compact ? "size-10" : "size-16",
        )}
      >
        <span className="absolute inset-2 rounded-full border border-border" />
        {waiting && (
          <span
            className="absolute inset-0 animate-[radar-sweep_3s_linear_infinite] motion-reduce:animate-none"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, var(--color-brand) 360deg)",
              borderRadius: "9999px",
              opacity: 0.5,
            }}
          />
        )}
        {!waiting && (
          <Check
            className="absolute inset-0 m-auto size-5 text-ok"
            aria-hidden="true"
          />
        )}
      </span>

      <p className="text-[13px] leading-[1.45] text-text-2">
        {waiting ? "Waiting for data…" : "First datapoint received"}
      </p>

      {!compact && (
        <>
          <div className="flex w-full max-w-md items-center gap-2 rounded-(--radius) border border-border bg-bg px-2 py-1.5">
            <code className="font-data min-w-0 flex-1 truncate text-left text-[12px] text-text">
              {snippet}
            </code>
            <button
              type="button"
              aria-label="Copy snippet"
              onClick={() => void copy()}
              className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
            >
              {copied ? (
                <Check className="size-3.5 text-ok" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-brand hover:text-brand-deep"
          >
            Setup docs <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </>
      )}
    </div>
  );
}
