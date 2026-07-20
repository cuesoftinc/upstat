"use client";

/**
 * Color-vision provider — the design.md §5 colorblind mode ("charts offer
 * pattern fills in colorblind mode"), persisted exactly like the theme
 * contract (ThemeProvider):
 *
 * - `default` (unset): charts differentiate series by the §2 palette alone;
 *   no `data-colorvision` attribute on <html>.
 * - `patterns`: `data-colorvision="patterns"` on <html>, persisted in
 *   localStorage under `upstat.colorvision`. Charts add non-color
 *   differentiation — stroke dash arrays on lines, stripe/hatch pattern
 *   fills on bars and stacks — and dot-only status pills swap the plain
 *   dot for a per-status glyph.
 *
 * The preference lives in an external module store (localStorage-backed,
 * read via useSyncExternalStore); a static inline script in the root
 * layout applies the persisted attribute before first paint. Unlike
 * useTheme, useColorVision is safe WITHOUT a provider (context default =
 * mode off) so leaf chart components stay renderable in isolation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

export type ColorVisionMode = "default" | "patterns";

export const COLOR_VISION_STORAGE_KEY = "upstat.colorvision";

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

function readStoredMode(): ColorVisionMode {
  try {
    const stored = window.localStorage.getItem(COLOR_VISION_STORAGE_KEY);
    if (stored === "patterns") return "patterns";
  } catch {
    // storage unavailable (private mode etc.) — fall through to the default
  }
  return "default";
}

function getServerSnapshot(): ColorVisionMode {
  return "default";
}

function applyMode(mode: ColorVisionMode): void {
  const root = document.documentElement;
  if (mode === "default") {
    root.removeAttribute("data-colorvision");
  } else {
    root.setAttribute("data-colorvision", mode);
  }
}

// -- context ------------------------------------------------------------------

interface ColorVisionContextValue {
  mode: ColorVisionMode;
  /** True when the patterns mode is on — the flag chart components read. */
  patterns: boolean;
  /** Set + persist the mode. */
  setMode: (mode: ColorVisionMode) => void;
}

// Default value (NOT null): leaf charts render without a provider (tests,
// isolated stories) with the mode simply off.
const ColorVisionContext = createContext<ColorVisionContextValue>({
  mode: "default",
  patterns: false,
  setMode: () => undefined,
});

export function ColorVisionProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(
    subscribe,
    readStoredMode,
    getServerSnapshot,
  );

  const setMode = useCallback((next: ColorVisionMode) => {
    applyMode(next);
    try {
      if (next === "default") {
        // default carries no storage entry — absence IS the default
        window.localStorage.removeItem(COLOR_VISION_STORAGE_KEY);
      } else {
        window.localStorage.setItem(COLOR_VISION_STORAGE_KEY, next);
      }
    } catch {
      // non-fatal: preference just won't persist
    }
    emit();
  }, []);

  const value = useMemo(
    () => ({ mode, patterns: mode === "patterns", setMode }),
    [mode, setMode],
  );

  return (
    <ColorVisionContext.Provider value={value}>
      {children}
    </ColorVisionContext.Provider>
  );
}

export function useColorVision(): ColorVisionContextValue {
  return useContext(ColorVisionContext);
}

/**
 * Pre-paint color-vision bootstrap (inlined by the root layout) — a fully
 * static string, same rules as themeInitScript; the literal storage key
 * must match COLOR_VISION_STORAGE_KEY (unit-tested).
 */
export const colorVisionInitScript =
  '(function(){try{var c=localStorage.getItem("upstat.colorvision");if(c==="patterns"){document.documentElement.setAttribute("data-colorvision","patterns");}}catch(e){}})();';

// -- shared pattern styling ---------------------------------------------------

/**
 * Per-series stroke dash arrays (§5 colorblind mode) — index 0 stays solid
 * as the visual baseline; the other seven are mutually distinguishable.
 * Indexed alongside the §2 series palette (i % 8).
 */
export const SERIES_DASHES = [
  "",
  "6 3",
  "2 2",
  "8 3 2 3",
  "1 3",
  "10 4",
  "4 2 1 2",
  "3 6",
] as const;

/** Dash for series index i ("" = solid). */
export function seriesDash(index: number): string {
  return SERIES_DASHES[index % SERIES_DASHES.length];
}

// stripe angles per index — paired with varying pitch below so equal-angle
// collisions (i and i+8) still differ
const STRIPE_ANGLES = [0, 45, 135, 90, 25, 115, 65, 155] as const;

/**
 * Stripe-overlay fill for HTML-rendered marks (TopList bars, LogHistogram
 * stacks, legend swatches): the mark keeps its series/level color and
 * gains `var(--color-bg)` stripes whose angle+pitch vary by index — series
 * stay distinguishable without relying on hue. Index 0 stays solid.
 */
export function patternFillStyle(color: string, index: number): CSSProperties {
  const i = index % 8;
  if (i === 0) return { background: color };
  const gap = 3 + (i % 3);
  return {
    backgroundColor: color,
    backgroundImage: `repeating-linear-gradient(${STRIPE_ANGLES[i]}deg, transparent 0 ${gap}px, var(--color-bg) ${gap}px ${gap + 1.5}px)`,
  };
}
