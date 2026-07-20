"use client";

/**
 * Theme provider — tri-state light | dark | system (SKILL.md theme parity
 * canon; theme contract ratified 2026-07-20, identical across apparule,
 * expendit and upstat):
 *
 * - `preference` is what the user chose; persisted at `upstat.theme`
 *   ("light"/"dark"/"system" stored explicitly; KEY ABSENT = dark, the
 *   design default — per e43f01c and the cross-product theme contract).
 * - `data-theme` on <html> always carries the RESOLVED theme ("light" or
 *   "dark"): explicit preferences resolve to themselves; system resolves
 *   via `prefers-color-scheme` and tracks it LIVE (matchMedia listener —
 *   an OS theme flip updates data-theme without a reload).
 * - tokens.css stays dark-first (`:root` is dark, design.md §2); the
 *   light values live under `[data-theme="light"]` plus a media-query
 *   fallback for the pre-JS/no-JS case; with JS the attribute is
 *   authoritative.
 *
 * The preference lives in an external module store (localStorage-backed,
 * read via useSyncExternalStore) so no state syncs through effects; a tiny
 * inline script in the root layout applies the resolved theme before first
 * paint (no FOUC in any mode, including system).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
/** Back-compat alias (pre-tri-state consumers named the resolved type). */
export type Theme = ResolvedTheme;

export const THEME_STORAGE_KEY = "upstat.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// -- external preference store ----------------------------------------------

const listeners = new Set<() => void>();

// System tracking: one module-level matchMedia listener, attached lazily on
// first subscription (client only), kept for the app lifetime.
let systemListenerAttached = false;

function onSystemChange(): void {
  // Only the system preference re-resolves on an OS flip.
  if (readStoredPreference() === "system") {
    applyResolved(resolveTheme("system"));
    emit();
  }
}

function ensureSystemListener(): void {
  if (systemListenerAttached || typeof window === "undefined") return;
  try {
    window.matchMedia(DARK_QUERY).addEventListener("change", onSystemChange);
    systemListenerAttached = true;
  } catch {
    // matchMedia unavailable — system just won't track live
  }
}

function subscribe(listener: () => void): () => void {
  ensureSystemListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
  } catch {
    // storage unavailable (private mode etc.) — fall through to the default
  }
  // Key absent = the product's design default (dark-first, design.md §2);
  // "system" is an explicit choice, stored like any other preference.
  return "dark";
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** Resolve a preference to the concrete theme ("system" → the OS theme). */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark() ? "dark" : "light";
}

function readResolvedTheme(): ResolvedTheme {
  return resolveTheme(readStoredPreference());
}

function getServerPreference(): ThemePreference {
  return "dark";
}

function getServerResolved(): ResolvedTheme {
  // Dark-first product (design.md §2): the SSR frame renders the
  // attribute-less dark default; the init script resolves before paint.
  return "dark";
}

function applyResolved(theme: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

// -- context ------------------------------------------------------------------

interface ThemeContextValue {
  /** The user's stored preference (may be "system"). */
  preference: ThemePreference;
  /** The concrete theme currently applied ("system" resolved live). */
  resolvedTheme: ResolvedTheme;
  /** Set + persist the preference ("system" is stored explicitly). */
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    readStoredPreference,
    getServerPreference,
  );
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    readResolvedTheme,
    getServerResolved,
  );

  const setPreference = useCallback((next: ThemePreference) => {
    applyResolved(resolveTheme(next));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // non-fatal: preference just won't persist
    }
    emit();
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

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
 * Applies the RESOLVED theme: stored light/dark verbatim, stored "system"
 * via the OS preference, key absent = dark (the design default) — no FOUC
 * in any mode.
 */
export const themeInitScript =
  '(function(){try{var t=localStorage.getItem("upstat.theme");if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}else if(t!=="light"&&t!=="dark"){t="dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();';
