"use client";

/**
 * Theme provider — manual light/dark override (SKILL.md "Marketing nav,
 * footer & theme parity canon", ported from apparule's contract):
 *
 * - unset (default): no `data-theme` attribute → tokens.css `:root` renders
 *   the design default, which for upstat is DARK (design.md §2 — there is
 *   deliberately no prefers-color-scheme auto-switch).
 * - `light`: `data-theme="light"` on <html>, persisted in localStorage
 *   under `upstat.theme`.
 *
 * The preference lives in an external module store (localStorage-backed,
 * read via useSyncExternalStore) so no state syncs through effects; a tiny
 * inline script in the root layout applies the persisted override before
 * first paint to avoid a theme flash.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "upstat.theme";

/** upstat's design default (design.md §2: dark-primary product). */
export const DEFAULT_THEME: Theme = "dark";

// -- external preference store ----------------------------------------------

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // storage unavailable (private mode etc.) — fall through to the default
  }
  return DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) {
    // the default carries no attribute — tokens.css `:root` IS dark
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

// -- context ------------------------------------------------------------------

interface ThemeContextValue {
  /** The resolved theme ("dark" unless the user chose light). */
  theme: Theme;
  /** Set + persist the theme. */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    getServerSnapshot,
  );

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // non-fatal: preference just won't persist
    }
    emit();
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Pre-paint theme bootstrap (inlined by the root layout). A fully static
 * string — no runtime code construction (CodeQL js/bad-code-sanitization);
 * the literal storage key must match THEME_STORAGE_KEY (unit-tested).
 * Only "light" needs applying — dark is the attribute-less default.
 */
export const themeInitScript =
  '(function(){try{var t=localStorage.getItem("upstat.theme");if(t==="light"){document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();';
