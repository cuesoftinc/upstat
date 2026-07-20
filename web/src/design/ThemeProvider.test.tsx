// Theme provider — tri-state contract (ratified 2026-07-20): preference
// light | dark | system persisted at upstat.theme (key absent = dark, the
// design default; "system" stored explicitly);
// data-theme always carries the RESOLVED theme; system tracks
// prefers-color-scheme live via a matchMedia listener. Upstat stays
// dark-first in design (tokens :root is dark), but the CONTRACT is the
// same as apparule/expendit.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  THEME_STORAGE_KEY,
  ThemeProvider,
  themeInitScript,
  useTheme,
} from "./ThemeProvider";

function Probe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference("dark")}>dark</button>
      <button onClick={() => setPreference("light")}>light</button>
      <button onClick={() => setPreference("system")}>system</button>
    </div>
  );
}

// Controllable matchMedia stand-in: the provider attaches ONE module-level
// change listener on first subscribe; `flipSystem` drives it like an OS
// theme change. Installed before the first render in this file so the
// provider binds to it.
let systemMatches = false;
const changeListeners = new Set<() => void>();
function flipSystem(matches: boolean) {
  systemMatches = matches;
  act(() => {
    for (const l of changeListeners) l();
  });
}

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return systemMatches;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: () => void) => changeListeners.add(cb),
    removeEventListener: (_: string, cb: () => void) =>
      changeListeners.delete(cb),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe("ThemeProvider (theme contract 2026-07-20, upstat.theme)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    systemMatches = false;
  });

  it("defaults to dark (the design default) when no key is stored", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("stored system resolves via the OS preference (both directions)", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("stored system resolves dark when the OS prefers dark", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    systemMatches = true;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("explicit choices apply the resolved attribute and persist under upstat.theme", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("choosing system stores it explicitly and re-resolves via the OS", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    await userEvent.click(screen.getByRole("button", { name: "system" }));
    // "system" is stored like any preference (key absent = design default);
    // the attribute stays populated with the RESOLVED theme.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByTestId("pref")).toHaveTextContent("system");
  });

  it("system mode tracks prefers-color-scheme changes live", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "system" }));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    flipSystem(true); // OS switches to dark
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    flipSystem(false); // and back
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("explicit preferences ignore OS theme changes", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    flipSystem(false);
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("reads a persisted light preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("init script uses the literal storage key and resolves system pre-paint", () => {
    expect(THEME_STORAGE_KEY).toBe("upstat.theme");
    expect(themeInitScript).toContain('localStorage.getItem("upstat.theme")');
    // System mode must resolve pre-paint (no FOUC): the script consults
    // prefers-color-scheme and always sets the resolved data-theme.
    expect(themeInitScript).toContain("prefers-color-scheme");
    expect(themeInitScript).toContain('setAttribute("data-theme",t)');
  });
});
