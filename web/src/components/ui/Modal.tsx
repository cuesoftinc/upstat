"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** §8.2b Modal/Sheet: modal sm/lg · right sheet (480px drawer, §2 layout). */
  variant?: "sm" | "lg" | "sheet";
  children: ReactNode;
  /** Footer actions slot. */
  footer?: ReactNode;
  className?: string;
}

/** Modal / Sheet — header + body slot + footer actions; z `sheet/modal 40`. */
export function Modal({
  open,
  onClose,
  title,
  variant = "sm",
  children,
  footer,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className={clsx(
        "fixed inset-0 z-[var(--z-modal)] bg-bg/70",
        variant === "sheet" ? "flex justify-end" : "flex items-center justify-center p-4",
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "font-ui flex flex-col border-border bg-bg-elev shadow-xl outline-none",
          variant === "sheet"
            ? "h-full w-[480px] animate-[sheet-in_var(--duration-entrance)_var(--ease-standard)] border-l motion-reduce:animate-none"
            : "max-h-[85vh] rounded-(--radius) border",
          variant === "sm" && "w-[400px]",
          variant === "lg" && "w-[640px]",
          className,
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[16px] font-semibold text-text">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
