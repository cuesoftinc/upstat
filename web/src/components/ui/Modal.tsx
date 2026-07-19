"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

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

/**
 * Modal / Sheet — header + body slot + footer actions; z `sheet/modal 40`.
 * W2 Radix convergence: behavior (focus trap, Escape, outside-dismiss,
 * scroll lock) rides @radix-ui/react-dialog; the rendered chrome is the
 * W1 Figma-QA'd markup unchanged.
 */
export function Modal({
  open,
  onClose,
  title,
  variant = "sm",
  children,
  footer,
  className,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* Content nests inside Overlay so the W1 flex-centering layer is
            byte-identical (Radix supports nesting for scrollable overlays). */}
        <Dialog.Overlay
          className={clsx(
            "fixed inset-0 z-[var(--z-modal)] bg-bg/70",
            variant === "sheet" ? "flex justify-end" : "flex items-center justify-center p-4",
          )}
        >
          <Dialog.Content
            ref={contentRef}
            aria-label={title}
            aria-describedby={undefined}
            tabIndex={-1}
            // W1 focus model: the panel itself takes focus on open (not the
            // first tabbable — Radix would otherwise focus the close button)
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              contentRef.current?.focus();
            }}
            className={clsx(
              "font-ui flex flex-col border-border bg-bg-elev shadow-xl outline-none",
              // sheets and modals clamp to the viewport — full-width sheet /
              // full-width dialog below their design widths (390 support)
              variant === "sheet"
                ? "h-full w-full max-w-[480px] animate-[sheet-in_var(--duration-entrance)_var(--ease-standard)] border-l motion-reduce:animate-none"
                : "max-h-[85vh] max-w-full rounded-(--radius) border",
              variant === "sm" && "w-[400px]",
              variant === "lg" && "w-[640px]",
              className,
            )}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title asChild>
                <h2 className="text-[16px] font-semibold text-text">{title}</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
            {footer && (
              <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
                {footer}
              </footer>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
