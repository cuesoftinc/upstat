"use client";

import { clsx } from "clsx";
import {
  Copy,
  GripVertical,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type WidgetShellMode = "view" | "edit" | "fullscreen";

export interface WidgetShellProps {
  title: string;
  /** Query chip (mono). */
  query?: string;
  mode?: WidgetShellMode;
  onModeChange?: (mode: WidgetShellMode) => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * WidgetShell — §3/§8.2: widget chrome (title · query · ⋯ menu); drag
 * handle appears on hover in edit mode (MI-11); fullscreen zooms to
 * viewport, ESC returns (MI-12).
 */
export function WidgetShell({
  title,
  query,
  mode = "view",
  onModeChange,
  onEdit,
  onDuplicate,
  onDelete,
  children,
  className,
}: WidgetShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (mode !== "fullscreen") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onModeChange?.("view");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, onModeChange]);

  return (
    <section
      data-mode={mode}
      className={clsx(
        "font-ui group flex flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-3",
        mode === "fullscreen" &&
          "fixed inset-4 z-[var(--z-modal)] transition-[inset] duration-[var(--duration-entrance)] ease-standard motion-reduce:transition-none",
        mode === "edit" && "border-dashed",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        {mode === "edit" && (
          <GripVertical
            aria-label="Drag to move"
            className="size-4 cursor-grab text-text-2 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100"
          />
        )}
        <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-text">{title}</h3>
        {query && (
          <code className="font-data hidden max-w-56 truncate rounded-(--radius) border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text-2 md:block">
            {query}
          </code>
        )}
        {mode === "fullscreen" ? (
          <button
            type="button"
            aria-label="Exit fullscreen"
            onClick={() => onModeChange?.("view")}
            className="text-text-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              aria-label={`Widget menu for ${title}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="text-text-2 opacity-0 transition-opacity duration-[var(--duration-fast)] hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {menuOpen && (
              <ul
                role="menu"
                className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 w-36 rounded-(--radius) border border-border bg-bg-elev py-1 shadow-lg"
              >
                {[
                  { label: "Edit", icon: Pencil, action: onEdit },
                  { label: "Duplicate", icon: Copy, action: onDuplicate },
                  {
                    label: "Fullscreen",
                    icon: Maximize2,
                    action: () => onModeChange?.("fullscreen"),
                  },
                  { label: "Delete", icon: Trash2, action: onDelete, destructive: true },
                ].map(({ label, icon: Icon, action, destructive }) => (
                  <li key={label} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        action?.();
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px]",
                        "transition-colors duration-[var(--duration-fast)] hover:bg-bg",
                        destructive ? "text-crit" : "text-text",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
