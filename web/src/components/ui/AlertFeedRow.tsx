"use client";

import * as Popover from "@radix-ui/react-popover";
import { clsx } from "clsx";
import type { ReactNode } from "react";
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
  /**
   * W2 Radix convergence: when a trigger is given (the TopBar bell, W3),
   * the panel rides @radix-ui/react-popover (anchor/dismiss/focus).
   * Without one it renders the plain panel — the W1 embed contract.
   */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

function NotificationPanel({
  events,
  onEventClick,
  className,
  ...rest
}: Pick<NotificationPopoverProps, "events" | "onEventClick" | "className"> &
  React.ComponentPropsWithRef<"div">) {
  return (
    <div
      // rest carries Popover.Content's slotted props (ref, positioning
      // callbacks) when composed via asChild; empty in the plain render
      {...rest}
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

/** NotificationPopover — §8.2b: empty / list. */
export function NotificationPopover({
  events,
  onEventClick,
  trigger,
  open,
  onOpenChange,
  className,
}: NotificationPopoverProps) {
  if (!trigger) {
    return <NotificationPanel events={events} onEventClick={onEventClick} className={className} />;
  }
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={4} asChild>
          <NotificationPanel events={events} onEventClick={onEventClick} className={className} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
