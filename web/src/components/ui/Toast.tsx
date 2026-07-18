"use client";

import { clsx } from "clsx";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";

export type ToastKind = "info" | "success" | "error";

export interface ToastProps {
  kind?: ToastKind;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
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
        "border border-border bg-bg-elev px-3 py-2 text-[13px] leading-[1.45] text-text shadow-lg",
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
