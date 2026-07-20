"use client";

import { clsx } from "clsx";
import { Mail, Trash2, Webhook } from "lucide-react";
import type { AlertChannel } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";

export interface AlertChannelCardProps {
  channel: AlertChannel;
  onVerify?: () => void;
  onDelete?: () => void;
  className?: string;
}

/** Health → pill status (master chips: VERIFIED ok · DEGRADED crit). */
const HEALTH_PILL: Record<AlertChannel["health"], StatusPillStatus> = {
  verified: "ok",
  unverified: "warn",
  degraded: "crit",
};

/** AlertChannelCard — §8.2 alert forms: webhook/email · unverified/verified/degraded. */
export function AlertChannelCard({
  channel,
  onVerify,
  onDelete,
  className,
}: AlertChannelCardProps) {
  const Icon = channel.kind === "email" ? Mail : Webhook;
  return (
    <div
      data-kind={channel.kind}
      data-health={channel.health}
      className={clsx(
        "font-ui flex items-center gap-3 rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-text-2" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] uppercase tracking-wide text-text-2">
          {channel.kind}
        </span>
        <span className="font-data truncate text-[13px] text-text">
          {channel.target}
        </span>
      </div>
      {/* health renders as a full StatusPill per the master (VERIFIED /
          DEGRADED chips, B8 130:2621) — lowercase colored text was drift
          (adjudicated 2026-07-20) */}
      <StatusPill
        status={HEALTH_PILL[channel.health]}
        label={channel.health.toUpperCase()}
        className="shrink-0"
      />
      {channel.health === "unverified" && onVerify && (
        <button
          type="button"
          onClick={onVerify}
          className="shrink-0 text-[12px] font-medium text-brand hover:text-brand-deep"
        >
          Verify
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete channel ${channel.target}`}
          onClick={onDelete}
          className="shrink-0 text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-crit"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
