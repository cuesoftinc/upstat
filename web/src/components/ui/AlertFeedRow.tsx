"use client";

import { clsx } from "clsx";
import type { AlertEvent } from "@/models";

export interface AlertFeedRowProps {
  event: AlertEvent;
  onClick?: () => void;
  className?: string;
}

/**
 * AlertFeedRow — §8.2b: sev tint sev1 / sev2 / resolved [Decided 2026-07-17]
 * · unread/read · 300ms slide-in (MI-14).
 */
export function AlertFeedRow({ event, onClick, className }: AlertFeedRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-sev={event.sev}
      data-unread={event.unread || undefined}
      className={clsx(
        "font-ui flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg",
        "animate-[slide-in_var(--duration-slow)_var(--ease-standard)] motion-reduce:animate-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "size-2 shrink-0 rounded-full",
          event.sev === "sev1" && "bg-crit",
          event.sev === "sev2" && "bg-warn",
          event.sev === "resolved" && "bg-ok",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={clsx(
            "truncate text-[13px]",
            event.unread ? "font-semibold text-text" : "font-normal text-text-2",
          )}
        >
          {event.monitor_name}
        </span>
        <span className="truncate text-[12px] text-text-2">{event.message}</span>
      </div>
      <time className="shrink-0 text-[11px] tabular-nums text-text-2">
        {event.ts.slice(11, 16)}
      </time>
      {event.unread && (
        <span aria-label="unread" className="size-1.5 shrink-0 rounded-full bg-brand" />
      )}
    </button>
  );
}

export interface NotificationPopoverProps {
  events: AlertEvent[];
  onEventClick?: (event: AlertEvent) => void;
  className?: string;
}

/** NotificationPopover — §8.2b: empty / list. */
export function NotificationPopover({ events, onEventClick, className }: NotificationPopoverProps) {
  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className={clsx(
        "font-ui z-[var(--z-dropdown)] w-96 overflow-hidden rounded-(--radius) border border-border bg-bg-elev shadow-lg",
        className,
      )}
    >
      <header className="border-b border-border px-3 py-2 text-[13px] font-semibold text-text">
        Alerts
      </header>
      {events.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-text-2">
          Nothing triggered. Calm seas.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {events.map((event) => (
            <AlertFeedRow key={event.id} event={event} onClick={() => onEventClick?.(event)} />
          ))}
        </div>
      )}
    </div>
  );
}
