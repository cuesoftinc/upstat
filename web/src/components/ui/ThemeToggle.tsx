"use client";

import { clsx } from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme, type ThemePreference } from "@/design/ThemeProvider";

export interface ThemeToggleProps {
  className?: string;
}

/** light → dark → system → light (theme contract 2026-07-20). */
export const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Accessible name: announces the active mode and the next one. */
export function themeToggleLabel(preference: ThemePreference): string {
  return `Theme: ${preference} — switch to ${THEME_CYCLE[preference]}`;
}

/**
 * ThemeToggle — the tri-state cycle control (theme contract, ratified
 * 2026-07-20, identical across apparule, expendit and upstat): cycles
 * light → dark → system with a distinct icon per mode (sun / moon /
 * monitor). Lives in the marketing nav, the dashboard TopBar utility
 * area and Settings; the choice persists via ThemeProvider
 * (`upstat.theme`; key absent = the design default, dark — system is an
 * explicit choice, e43f01c).
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
  const Icon = THEME_ICONS[preference];
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={themeToggleLabel(preference)}
      onClick={() => setPreference(THEME_CYCLE[preference])}
      className={clsx(
        "rounded-(--radius) p-1.5 text-text-2",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev hover:text-text",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4.5" />
    </button>
  );
}
