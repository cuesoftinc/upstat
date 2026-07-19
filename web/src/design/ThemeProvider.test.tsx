import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeProvider,
  themeInitScript,
  useTheme,
} from "./ThemeProvider";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      theme:{theme}
    </button>
  );
}

describe("ThemeProvider (theme-parity canon, upstat.theme)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to upstat's design default (dark) when unset", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(DEFAULT_THEME).toBe("dark");
    expect(screen.getByRole("button")).toHaveTextContent("theme:dark");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("light: sets data-theme on <html> and persists under upstat.theme", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    // and back: dark clears the attribute (the default needs none)
    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("reads a persisted light preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
  });

  it("init script uses the literal storage key (pre-paint bootstrap)", () => {
    expect(THEME_STORAGE_KEY).toBe("upstat.theme");
    expect(themeInitScript).toContain('localStorage.getItem("upstat.theme")');
    expect(themeInitScript).toContain('setAttribute("data-theme","light")');
  });
});
