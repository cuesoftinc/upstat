"use client";

import { clsx } from "clsx";
import { Mail, Trash2, Webhook } from "lucide-react";
import type { AlertChannel } from "@/models";
import { StatusPill } from "./StatusPill";

export interface AlertChannelCardProps {
  channel: AlertChannel;
  onVerify?: () => void;
  onDelete?: () => void;
  className?: string;
}

const KIND_LABEL: Record<AlertChannel["kind"], string> = {
  email: "Email",
  webhook: "Webhook",
};

/** Entity-status pill mapping (systemic adjudication 2026-07-20: labeled
 *  StatusPills, never lowercase colored text). */
const HEALTH_PILL: Record<
  AlertChannel["health"],
  { status: "ok" | "warn" | "crit"; label: string }
> = {
  verified: { status: "ok", label: "VERIFIED" },
  unverified: { status: "warn", label: "UNVERIFIED" },
  degraded: { status: "crit", label: "DEGRADED" },
};

/**
 * Masked display form of the channel target (master anatomy): webhook URLs
 * keep origin + first path segment, then truncate each remaining segment
 * ("https://hooks.slack.com/services/T0UP…/B0AL…"). Emails render verbatim.
 */
export function maskChannelTarget(target: string): string {
  if (!/^https?:\/\//.test(target)) return target;
  try {
    const url = new URL(target);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return `${url.origin}${url.pathname}`;
    const [first, ...rest] = segments;
    const masked = rest.map((s) => (s.length > 4 ? `${s.slice(0, 4)}…` : s));
    return `${url.origin}/${[first, ...masked].join("/")}`;
  } catch {
    return target;
  }
}

/**
 * AlertChannelCard — §8.2 alert forms: webhook/email ·
 * unverified/verified/degraded. Master anatomy: kind icon · friendly name ·
 * labeled StatusPill · masked target (mono) · degraded failure caption.
 */
export function AlertChannelCard({
  channel,
  onVerify,
  onDelete,
  className,
}: AlertChannelCardProps) {
  const Icon = channel.kind === "email" ? Mail : Webhook;
  const pill = HEALTH_PILL[channel.health];
  return (
    <div
      data-kind={channel.kind}
      data-health={channel.health}
      className={clsx(
        "font-ui flex items-start gap-3 rounded-(--radius) border border-border bg-bg-elev p-3",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
            {channel.name ?? KIND_LABEL[channel.kind]}
          </span>
          <StatusPill status={pill.status} label={pill.label} />
        </span>
        <span className="font-data truncate text-[12px] text-text-2">
          {maskChannelTarget(channel.target)}
        </span>
        {channel.health === "degraded" && channel.failure_note && (
          <span className="text-[12px] text-crit">{channel.failure_note}</span>
        )}
      </div>
      {channel.health === "unverified" && onVerify && (
        <button
          type="button"
          onClick={onVerify}
          className="mt-0.5 shrink-0 text-[12px] font-medium text-brand-text hover:text-brand-deep"
        >
          Verify
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete channel ${channel.name ?? channel.target}`}
          onClick={onDelete}
          className="mt-1 shrink-0 text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-crit"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
