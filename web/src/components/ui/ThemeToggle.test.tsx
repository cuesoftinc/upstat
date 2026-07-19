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

  it("flips dark ⇄ light with a labelled control", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByTestId("theme-toggle");
    expect(toggle).toHaveAccessibleName("Switch to light theme");
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(toggle).toHaveAccessibleName("Switch to dark theme");
    await userEvent.click(toggle);
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
