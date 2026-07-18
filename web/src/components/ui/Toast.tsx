"use client";

import { clsx } from "clsx";
import { Bell, CheckCircle2, XCircle, X } from "lucide-react";

export type ToastKind = "info" | "success" | "error";

export interface ToastProps {
  kind?: ToastKind;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

// info carries the bell (Figma 38:21 icon/bell), not an info glyph.
const ICONS: Record<ToastKind, typeof Bell> = {
  info: Bell,
  success: CheckCircle2,
  error: XCircle,
};

/** Toast — §8.2 kind: info / success / error; lives on z `toast 50`. */
export function Toast({ kind = "info", message, onDismiss, className }: ToastProps) {
  const Icon = ICONS[kind];
  return (
    <div
      role="status"
      data-kind={kind}
      className={clsx(
        "font-ui z-[var(--z-toast)] flex w-fit min-w-[240px] items-center gap-2 rounded-(--radius)",
        "border border-border bg-bg-elev px-3 py-2.5 text-[13px] leading-[1.45] text-text",
        "shadow-[0px_4px_16px_0px_rgba(0,0,0,0.4)]", // Figma 38:42 toast shadow
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={clsx(
          "size-4 shrink-0",
          kind === "info" && "text-brand",
          kind === "success" && "text-ok",
          kind === "error" && "text-crit",
        )}
      />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
