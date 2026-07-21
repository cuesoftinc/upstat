"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { KbdChip } from "./KbdChip";

export interface CommandItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Kbd hint, e.g. `g d` (MI-17). */
  kbd?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  onSelect?: (item: CommandItem) => void;
  className?: string;
}

/**
 * CommandPalette / SearchOverlay — §8.2b: empty / results / no-results.
 * Radix-Dialog convergence (deferral sweep 2026-07-21): the dialog
 * behavior — focus trap, Escape-anywhere, outside-dismiss, and the P4
 * focus restore back to the pre-open element — rides
 * `@radix-ui/react-dialog`; the rendered chrome is the QA'd markup
 * unchanged.
 */
export function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
  className,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus restore (fleet P4): the palette opens programmatically ("/",
  // ⌘K or the TopBar search button), so closing must hand focus back to
  // whatever element had it before the input grabbed focus. The P4 lock
  // asserts the restore the moment the palette is gone — Radix's own
  // restore runs a tick later — so the snapshot/restore pair stays ours.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(
    () =>
      query
        ? items.filter((i) =>
            i.label.toLowerCase().includes(query.toLowerCase()),
          )
        : items,
    [items, query],
  );

  // reset on open transition — render-phase derive (no setState-in-effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  // Closing sends focus back synchronously once the palette's DOM is gone.
  useEffect(() => {
    if (open) return;
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (opener?.isConnected) opener.focus();
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* Content nests inside Overlay so the scrim + flex-positioning
            layer stays byte-identical (the Modal.tsx convergence pattern). */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center bg-bg/70 pt-[15vh]">
          <Dialog.Content
            aria-describedby={undefined}
            // Radix hides the outside tree via aria-hidden but leaves
            // aria-modal off; the a11y locks assert the attribute.
            aria-modal="true"
            // Opening snapshots the opener BEFORE the input grabs focus
            // (this fires while the pre-open element still has it).
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              returnFocusRef.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
              inputRef.current?.focus();
            }}
            // The synchronous restore above owns focus hand-back.
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={clsx(
              "font-ui w-[560px] overflow-hidden rounded-(--radius) border border-border bg-bg-elev shadow-xl",
              className,
            )}
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search aria-hidden="true" className="size-4 text-text-2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Enter" && results[active]) {
                    onSelect?.(results[active]);
                    onClose();
                  }
                }}
                placeholder="Search dashboards, monitors, services…"
                aria-label="Search"
                className="h-11 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-2 focus:outline-none"
              />
            </div>
            <ul
              role="listbox"
              aria-label="Results"
              className="max-h-72 overflow-y-auto py-1"
            >
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-[13px] text-text-2">
                  No results for “{query}”
                </li>
              )}
              {results.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onClick={() => {
                        onSelect?.(item);
                        onClose();
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={clsx(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text",
                        "transition-colors duration-[var(--duration-fast)]",
                        i === active && "bg-bg",
                      )}
                    >
                      {Icon && (
                        <Icon
                          aria-hidden="true"
                          className="size-4 text-text-2"
                        />
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.kbd && <KbdChip keys={item.kbd} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
