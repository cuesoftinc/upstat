"use client";

import { clsx } from "clsx";
import { Check, Copy, Key, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ApiKey } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";

export interface APIKeyRowProps {
  apiKey: ApiKey;
  onRevoke?: () => void;
  className?: string;
}

/** Entity-status pill mapping (systemic adjudication 2026-07-20: labeled
 *  StatusPills, never lowercase colored text). */
const STATUS_PILL: Record<
  ApiKey["status"],
  { status: StatusPillStatus; label: string }
> = {
  active: { status: "ok", label: "ACTIVE" },
  rotation_grace: { status: "warn", label: "ROTATING" },
  revoked: { status: "nodata", label: "REVOKED" },
};

/** Per-signal scope chips (master anatomy: [logs][metrics][traces] / [rum]). */
const SCOPE_SIGNALS: Record<ApiKey["scope"], string[]> = {
  otlp: ["logs", "metrics", "traces"],
  rum: ["rum"],
  statsd: ["metrics"],
  all: ["logs", "metrics", "traces", "rum"],
};

/**
 * APIKeyRow / PropertyKeyRow — §8.2b: kind ingestion-token (scope chips) /
 * property-key (RUM) · active / rotation-grace / revoked · mono key + copy +
 * rejection counter. Master anatomy: key icon · name · masked key chip ·
 * per-signal scope chips · grace/rejects meta · labeled StatusPill.
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

  const pill = STATUS_PILL[apiKey.status];
  // master copy: rotating rows carry the grace deadline (24h rotation
  // contract, data-model.md §2); active rows the 24h rejection counter
  const meta =
    apiKey.status === "rotation_grace"
      ? "grace ends in 24h"
      : apiKey.status === "active"
        ? `${apiKey.rejected_count} rejects (24h)`
        : null;

  return (
    <div
      data-status={apiKey.status}
      data-kind={apiKey.kind}
      className={clsx(
        "font-ui @container flex items-center gap-3 border-b border-border px-3 py-2.5",
        apiKey.status === "revoked" && "opacity-60",
        className,
      )}
    >
      <Key aria-hidden="true" className="size-4 shrink-0 text-text-2" />
      <span className="min-w-0 shrink truncate text-[13px] font-medium text-text">
        {apiKey.name}
      </span>
      {/* the chip may shrink — at 390 the row's fixed parts (icon · chip ·
          pill · trash) exceeded the column and panned <main> (e2e 390 sweep);
          the masked key truncates before anything overflows */}
      <span className="flex min-w-0 shrink items-center gap-1.5 rounded-(--radius) border border-border px-1.5 py-0.5">
        <code className="font-data min-w-0 truncate text-[12px] text-text-2">
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
      <span className="hidden items-center gap-1 @[26rem]:flex">
        {SCOPE_SIGNALS[apiKey.scope].map((signal) => (
          <span
            key={signal}
            className="font-data rounded-(--radius) border border-border px-1 py-px text-[10px] tracking-wide text-text-2"
          >
            {signal}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1" />
      {/* Trailing meta clips in narrow compositions (368px how-it-works
          column) — the Figma master hides it there, so the row hides it
          below 416px of its own width (container query, not viewport). */}
      {meta && (
        <span className="font-data hidden shrink-0 text-[12px] tabular-nums text-text-2 @[26rem]:block">
          {meta}
        </span>
      )}
      <StatusPill status={pill.status} label={pill.label} />
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
