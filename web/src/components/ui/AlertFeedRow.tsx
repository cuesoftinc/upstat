"use client";

import * as Popover from "@radix-ui/react-popover";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { AlertEvent } from "@/models";

/**
 * Feed age — relative ("2m ago" / "3h ago" / "2d ago") per the master
 * (94:1513: dot · SevChip · title · age). Derived from the ISO string,
 * clock-safe at zero/negative deltas.
 */
function feedAge(ts: string, now = Date.now()): string {
  const min = Math.max(Math.round((now - Date.parse(ts)) / 60_000), 0);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Tinted mono sev chip (master construction — the feed's chip is the
 *  tint-bg mono treatment, distinct from the solid banner SevChip). */
const SEV_CHIP: Record<
  AlertEvent["sev"],
  { label: string; className: string }
> = {
  sev1: { label: "SEV-1", className: "bg-crit/14 text-crit" },
  sev2: { label: "SEV-2", className: "bg-warn/14 text-warn" },
  resolved: { label: "OK", className: "bg-ok/14 text-ok" },
};

export interface AlertFeedRowProps {
  event: AlertEvent;
  onClick?: () => void;
  className?: string;
}

/**
 * AlertFeedRow — §8.2b: sev tint sev1 / sev2 / resolved [Decided 2026-07-17]
 * · unread/read · 300ms slide-in (MI-14). Single-line construction per the
 * master (94:1513): unread dot · sev chip · title · age; the message detail
 * stays on the row tooltip.
 */
export function AlertFeedRow({ event, onClick, className }: AlertFeedRowProps) {
  const chip = SEV_CHIP[event.sev];
  return (
    <button
      type="button"
      onClick={onClick}
      title={event.message}
      data-sev={event.sev}
      data-unread={event.unread || undefined}
      className={clsx(
        "font-ui flex h-8 w-full items-center gap-2 border-b border-border px-3 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg",
        "animate-[slide-in_var(--duration-slow)_var(--ease-standard)] motion-reduce:animate-none",
        className,
      )}
    >
      {/* fixed slot: the brand unread dot; read rows keep the alignment */}
      <span className="flex size-2 shrink-0 items-center justify-center">
        {event.unread && (
          <span aria-label="unread" className="size-2 rounded-full bg-brand" />
        )}
      </span>
      <span
        className={clsx(
          "font-data inline-flex h-5 shrink-0 items-center rounded-(--radius) px-1.5 text-[11px] font-medium",
          chip.className,
        )}
      >
        {chip.label}
      </span>
      <span
        className={clsx(
          "min-w-0 flex-1 truncate text-[13px]",
          event.unread ? "font-semibold text-text" : "font-normal text-text-2",
        )}
      >
        {event.monitor_name}
      </span>
      <time
        dateTime={event.ts}
        className="shrink-0 text-[11px] tabular-nums text-text-2"
      >
        {feedAge(event.ts)}
      </time>
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
        // max-w clamp: right-anchored near the viewport edge, the panel must
        // never overflow the screen (review class 2026-07-19, expendit)
        "font-ui z-[var(--z-dropdown)] w-96 max-w-[calc(100vw-16px)] overflow-hidden rounded-(--radius) border border-border bg-bg-elev shadow-lg",
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
            <AlertFeedRow
              key={event.id}
              event={event}
              onClick={() => onEventClick?.(event)}
            />
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
    return (
      <NotificationPanel
        events={events}
        onEventClick={onEventClick}
        className={className}
      />
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          asChild
        >
          <NotificationPanel
            events={events}
            onEventClick={onEventClick}
            className={className}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
