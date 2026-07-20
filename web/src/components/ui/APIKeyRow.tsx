"use client";

import { clsx } from "clsx";
import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ApiKey } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";

export interface APIKeyRowProps {
  apiKey: ApiKey;
  onRevoke?: () => void;
  className?: string;
}

// Full StatusPill per the APIKeyRow master (ACTIVE / ROTATING chips,
// B12 132:3237) — lowercase colored text was drift (adjudicated 2026-07-20).
const STATUS_PILL: Record<
  ApiKey["status"],
  { status: StatusPillStatus; label: string }
> = {
  active: { status: "ok", label: "ACTIVE" },
  rotation_grace: { status: "warn", label: "ROTATING" },
  revoked: { status: "nodata", label: "REVOKED" },
};

/**
 * APIKeyRow / PropertyKeyRow — §8.2b: kind ingestion-token (scope chips) /
 * property-key (RUM) · active / rotation-grace / revoked · mono key + copy +
 * rejection counter.
 */
export function APIKeyRow({ apiKey, onRevoke, className }: APIKeyRowProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.key_masked);
    } catch {
      // non-secure context — feedback still shown
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      data-status={apiKey.status}
      data-kind={apiKey.kind}
      className={clsx(
        "font-ui @container flex items-center gap-3 border-b border-border px-3 py-2",
        apiKey.status === "revoked" && "opacity-60",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text">
          {apiKey.name}
          <span className="rounded-(--radius) border border-border px-1 text-[10px] uppercase tracking-wide text-text-2">
            {apiKey.kind === "property_key" ? "property" : apiKey.scope}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <code className="font-data text-[12px] text-text-2">
            {apiKey.key_masked}
          </code>
          <button
            type="button"
            aria-label={`Copy key ${apiKey.name}`}
            onClick={() => void copy()}
            className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            {copied ? (
              <Check className="size-3 text-ok" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </span>
      </div>
      {/* Trailing stat clips in narrow compositions (368px how-it-works
          column) — the Figma master hides it there, so the row hides it
          below 416px of its own width (container query, not viewport). */}
      <span className="hidden w-24 shrink-0 text-right text-[12px] tabular-nums text-text-2 @[26rem]:block">
        {apiKey.rejected_count} rejected
      </span>
      <StatusPill
        status={STATUS_PILL[apiKey.status].status}
        label={STATUS_PILL[apiKey.status].label}
        className="shrink-0"
      />
      {onRevoke && apiKey.status !== "revoked" && (
        <button
          type="button"
          aria-label={`Revoke ${apiKey.name}`}
          onClick={onRevoke}
          className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-crit"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
