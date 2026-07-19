"use client";

import { clsx } from "clsx";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/design/ThemeProvider";

export interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle — light/dark flip (SKILL.md theme-parity canon). Lives in the
 * marketing nav, the dashboard TopBar utility area and Settings; the choice
 * persists via ThemeProvider (`upstat.theme`).
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
      className={clsx(
        "rounded-(--radius) p-1.5 text-text-2",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev hover:text-text",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4.5" />
      ) : (
        <Moon aria-hidden="true" className="size-4.5" />
      )}
    </button>
  );
}
