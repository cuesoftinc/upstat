"use client";

import { clsx } from "clsx";
import { StatusPill, type StatusPillStatus } from "./StatusPill";
import { Switch } from "./Switch";

export interface MonitorRowProps {
  status: StatusPillStatus;
  name: string;
  /** Query/target summary, mono. */
  summary: string;
  /** Human "last triggered", e.g. `3h ago` (— when never). */
  lastTriggered?: string;
  muted: boolean;
  onMutedChange?: (muted: boolean) => void;
  onClick?: () => void;
  className?: string;
}

/** MonitorRow — §3/§8.2: status ×6 · muted toggle on/off. */
export function MonitorRow({
  status,
  name,
  summary,
  lastTriggered,
  muted,
  onMutedChange,
  onClick,
  className,
}: MonitorRowProps) {
  return (
    <div
      data-status={status}
      className={clsx(
        "font-ui flex h-10 items-center gap-3 border-b border-border px-3",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
        muted && "opacity-60",
        className,
      )}
    >
      {/* full labeled pill per the MonitorRow master (status ×6) — dot-only
          is reserved for the §5 colorblind rendering, not a row default
          (adjudicated 2026-07-20) */}
      <StatusPill status={status} />
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="w-44 truncate text-[13px] font-medium text-text">
          {name}
        </span>
        <span className="font-data min-w-0 flex-1 truncate text-[12px] text-text-2">
          {summary}
        </span>
        <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-text-2">
          {lastTriggered ?? "—"}
        </span>
      </button>
      <Switch
        checked={muted}
        onCheckedChange={onMutedChange}
        aria-label={`Mute ${name}`}
      />
    </div>
  );
}
