"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { KbdChip } from "./KbdChip";

export interface ShortcutEntry {
  keys: string;
  label: string;
}

export interface ShortcutCheatsheetProps {
  open: boolean;
  onClose?: () => void;
  /** Defaults to the MI-17 keyboard map. */
  shortcuts?: ShortcutEntry[];
  className?: string;
}

const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  { keys: "g d", label: "Go to dashboards" },
  { keys: "g l", label: "Go to logs" },
  { keys: "g m", label: "Go to monitors" },
  { keys: "⌘K", label: "Search" },
  { keys: "/", label: "Search" },
  { keys: "e", label: "Toggle dashboard edit mode" },
  { keys: "j", label: "Next log line" },
  { keys: "k", label: "Previous log line" },
  { keys: "?", label: "This cheatsheet" },
];

/**
 * ShortcutCheatsheet — `?` overlay, 2-col grid (MI-17, §8.2b).
 * Radix-Dialog convergence (deferral sweep 2026-07-21): dismissal
 * (Escape-anywhere per MI-17, scrim click), focus trap and focus restore
 * ride `@radix-ui/react-dialog`; the rendered chrome is unchanged.
 */
export function ShortcutCheatsheet({
  open,
  onClose,
  shortcuts = DEFAULT_SHORTCUTS,
  className,
}: ShortcutCheatsheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose?.()}>
      <Dialog.Portal>
        {/* Content nests inside Overlay so the scrim + flex-centering
            layer stays byte-identical (the Modal.tsx convergence pattern). */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-bg/70">
          <Dialog.Content
            aria-describedby={undefined}
            className={clsx(
              "font-ui w-[480px] rounded-(--radius) border border-border bg-bg-elev p-4 shadow-xl",
              className,
            )}
          >
            <Dialog.Title asChild>
              <h2 className="mb-3 text-[16px] font-semibold text-text">
                Keyboard shortcuts
              </h2>
            </Dialog.Title>
            {/* semantic: shortcut map is a definition list (label → keys) */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              {shortcuts.map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between gap-2"
                >
                  <dt className="text-[13px] leading-[1.45] text-text-2">
                    {s.label}
                  </dt>
                  <dd className="m-0">
                    <KbdChip keys={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
