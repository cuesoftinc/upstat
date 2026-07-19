"use client";

import { clsx } from "clsx";
import { useEffect } from "react";
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
  { keys: "/", label: "Search" },
  { keys: "e", label: "Toggle dashboard edit mode" },
  { keys: "j", label: "Next log line" },
  { keys: "k", label: "Previous log line" },
  { keys: "?", label: "This cheatsheet" },
];

/** ShortcutCheatsheet — `?` overlay, 2-col grid (MI-17, §8.2b). */
export function ShortcutCheatsheet({
  open,
  onClose,
  shortcuts = DEFAULT_SHORTCUTS,
  className,
}: ShortcutCheatsheetProps) {
  // ESC dismisses the overlay (MI-17 — the `?` sheet trapped keyboard
  // users behind a click-only backdrop; system-QA finding 2026-07-19)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-bg/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "font-ui w-[480px] rounded-(--radius) border border-border bg-bg-elev p-4 shadow-xl",
          className,
        )}
      >
        <h2 className="mb-3 text-[16px] font-semibold text-text">
          Keyboard shortcuts
        </h2>
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
      </div>
    </div>
  );
}
