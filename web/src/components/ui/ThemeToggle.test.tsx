// ThemeToggle: cycles the ThemeProvider preference light → dark → system
// (theme contract 2026-07-20); persists under `upstat.theme` with
// KEY ABSENT = system; the aria-label announces the active mode.
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/design/ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("cycles light → dark → system with a labelled control", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByTestId("theme-toggle");
    // Key absent = dark, the design default — the label announces it.
    expect(toggle).toHaveAccessibleName("Theme: dark — switch to system");
    await userEvent.click(toggle);
    // "system" is stored explicitly; data-theme carries the RESOLVED theme
    // (light — the jsdom matchMedia stub reports no dark preference).
    expect(window.localStorage.getItem("upstat.theme")).toBe("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(toggle).toHaveAccessibleName("Theme: system — switch to light");
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("upstat.theme")).toBe("light");
    expect(toggle).toHaveAccessibleName("Theme: light — switch to dark");
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("upstat.theme")).toBe("dark");
    expect(toggle).toHaveAccessibleName("Theme: dark — switch to system");
  });
});
