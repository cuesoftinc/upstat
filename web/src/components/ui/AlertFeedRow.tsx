"use client";

import * as Popover from "@radix-ui/react-popover";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { AlertEvent } from "@/models";
import { SevChip } from "./SevChip";

/**
 * Feed age — the master's relative idiom ("2m ago" / "18m ago" / "1h ago",
 * 94:1513). Relative ages stay honest across days (the earlier bare-HH:mm
 * form read 4-day-old events as today; UX walk 2026-07-19).
 */
function feedAge(ts: string): string {
  const min = Math.max(Math.round((Date.now() - Date.parse(ts)) / 60_000), 0);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export interface AlertFeedRowProps {
  event: AlertEvent;
  onClick?: () => void;
  className?: string;
}

/**
 * AlertFeedRow — §8.2b: sev1 / sev2 / resolved · unread/read · 300ms
 * slide-in (MI-14). Construction per the master (94:1513, adjudicated
 * 2026-07-20): ONE line — [unread brand dot] · SevChip (OK chip when
 * resolved) · title · relative age. The message detail line was a code
 * extension; the message still feeds the declare-incident prefill.
 */
export function AlertFeedRow({ event, onClick, className }: AlertFeedRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-sev={event.sev}
      data-unread={event.unread || undefined}
      title={event.message}
      className={clsx(
        "font-ui flex h-8 w-full items-center gap-2 border-b border-border px-3 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg",
        "animate-[slide-in_var(--duration-slow)_var(--ease-standard)] motion-reduce:animate-none",
        className,
      )}
    >
      {event.unread && (
        <span
          aria-label="unread"
          className="size-2 shrink-0 rounded-full bg-brand"
        />
      )}
      {event.sev === "resolved" ? (
        <span className="font-ui inline-flex h-5 shrink-0 items-center rounded-(--radius) bg-ok/14 px-1.5 text-[11px] font-semibold text-ok">
          OK
        </span>
      ) : (
        <SevChip sev={event.sev === "sev1" ? 1 : 2} className="shrink-0" />
      )}
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
